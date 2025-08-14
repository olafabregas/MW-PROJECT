const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { logger } = require("../utils/logger");
const cacheService = require("../utils/cache");

class BackupService {
  constructor() {
    this.backupDir = path.join(process.cwd(), "backups");
    this.maxBackups = 30; // Keep last 30 backups
    this.init();
  }

  async init() {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Start scheduled backups
      this.startScheduledBackups();

      logger.info("Backup service initialized");
    } catch (error) {
      logger.error("Failed to initialize backup service:", error);
    }
  }

  // Create full database backup
  async createDatabaseBackup(options = {}) {
    try {
      const { type = "full", compress = true, includeIndexes = true } = options;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `backup_${type}_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      logger.info(`Starting ${type} database backup: ${backupName}`);

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Get MongoDB connection details
      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/olympia";
      const dbName = this.extractDbName(mongoUri);

      // Create mongodump command
      let command = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;

      if (!includeIndexes) {
        command += " --noIndexRestore";
      }

      // Execute backup
      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes("done dumping")) {
        throw new Error(`Backup failed: ${stderr}`);
      }

      // Compress backup if requested
      if (compress) {
        await this.compressBackup(backupPath, `${backupPath}.tar.gz`);
        await fs.rmdir(backupPath, { recursive: true });
      }

      // Create backup metadata
      const metadata = {
        name: backupName,
        type,
        created: new Date(),
        size: await this.getBackupSize(
          compress ? `${backupPath}.tar.gz` : backupPath
        ),
        compressed: compress,
        collections: await this.getCollectionStats(),
        mongoVersion: await this.getMongoVersion(),
        nodeVersion: process.version,
      };

      await this.saveBackupMetadata(backupName, metadata);

      // Cleanup old backups
      await this.cleanupOldBackups();

      logger.info(`Database backup completed successfully: ${backupName}`);

      return {
        success: true,
        backupName,
        metadata,
        path: compress ? `${backupPath}.tar.gz` : backupPath,
      };
    } catch (error) {
      logger.error("Database backup failed:", error);
      throw error;
    }
  }

  // Create incremental backup (only changed data)
  async createIncrementalBackup() {
    try {
      // Get last backup timestamp
      const lastBackupTime = await this.getLastBackupTime();

      if (!lastBackupTime) {
        logger.info("No previous backup found, creating full backup instead");
        return await this.createDatabaseBackup({ type: "incremental_full" });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `backup_incremental_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      logger.info(`Starting incremental backup since ${lastBackupTime}`);

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Export only changed documents
      const collections = ["users", "reviews"];
      const changes = {};

      for (const collectionName of collections) {
        const changedDocs = await this.getChangedDocuments(
          collectionName,
          lastBackupTime
        );

        if (changedDocs.length > 0) {
          const filePath = path.join(backupPath, `${collectionName}.json`);
          await fs.writeFile(filePath, JSON.stringify(changedDocs, null, 2));
          changes[collectionName] = changedDocs.length;
        }
      }

      // Create metadata
      const metadata = {
        name: backupName,
        type: "incremental",
        created: new Date(),
        since: lastBackupTime,
        changes,
        size: await this.getBackupSize(backupPath),
      };

      await this.saveBackupMetadata(backupName, metadata);

      logger.info(`Incremental backup completed: ${JSON.stringify(changes)}`);

      return {
        success: true,
        backupName,
        metadata,
        changes,
      };
    } catch (error) {
      logger.error("Incremental backup failed:", error);
      throw error;
    }
  }

  // Restore database from backup
  async restoreFromBackup(backupName, options = {}) {
    try {
      const {
        dropBeforeRestore = false,
        restoreIndexes = true,
        dryRun = false,
      } = options;

      logger.info(`Starting database restore from: ${backupName}`);

      const backupPath = path.join(this.backupDir, backupName);
      const metadata = await this.getBackupMetadata(backupName);

      if (!metadata) {
        throw new Error(`Backup metadata not found for: ${backupName}`);
      }

      if (dryRun) {
        logger.info("Dry run mode - no actual restore will be performed");
        return {
          success: true,
          dryRun: true,
          metadata,
          message: "Restore validation successful",
        };
      }

      // Check if backup is compressed
      let actualBackupPath = backupPath;
      if (metadata.compressed) {
        actualBackupPath = `${backupPath}.tar.gz`;

        // Extract compressed backup
        await this.extractBackup(actualBackupPath, backupPath);
      }

      // Get MongoDB connection details
      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/olympia";

      // Create mongorestore command
      let command = `mongorestore --uri="${mongoUri}"`;

      if (dropBeforeRestore) {
        command += " --drop";
      }

      if (!restoreIndexes) {
        command += " --noIndexRestore";
      }

      command += ` "${actualBackupPath}"`;

      // Execute restore
      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes("done")) {
        throw new Error(`Restore failed: ${stderr}`);
      }

      // Clean up extracted files if backup was compressed
      if (metadata.compressed) {
        await fs.rmdir(backupPath, { recursive: true });
      }

      logger.info(
        `Database restore completed successfully from: ${backupName}`
      );

      return {
        success: true,
        backupName,
        metadata,
        restoredAt: new Date(),
      };
    } catch (error) {
      logger.error("Database restore failed:", error);
      throw error;
    }
  }

  // Export specific collections
  async exportCollections(collections, format = "json") {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const exportName = `export_${timestamp}`;
      const exportPath = path.join(this.backupDir, exportName);

      await fs.mkdir(exportPath, { recursive: true });

      const results = {};

      for (const collectionName of collections) {
        const collection = mongoose.connection.collection(collectionName);
        const documents = await collection.find({}).toArray();

        let fileName, content;

        if (format === "json") {
          fileName = `${collectionName}.json`;
          content = JSON.stringify(documents, null, 2);
        } else if (format === "csv") {
          fileName = `${collectionName}.csv`;
          content = await this.convertToCSV(documents);
        }

        const filePath = path.join(exportPath, fileName);
        await fs.writeFile(filePath, content);

        results[collectionName] = {
          fileName,
          documentCount: documents.length,
          size: content.length,
        };
      }

      logger.info(`Collections exported: ${JSON.stringify(results)}`);

      return {
        success: true,
        exportName,
        exportPath,
        results,
      };
    } catch (error) {
      logger.error("Collection export failed:", error);
      throw error;
    }
  }

  // List available backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.startsWith("backup_") && !file.endsWith(".json")) {
          const metadata = await this.getBackupMetadata(
            file.replace(".tar.gz", "")
          );

          if (metadata) {
            backups.push({
              name: file,
              ...metadata,
            });
          }
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      return backups;
    } catch (error) {
      logger.error("Failed to list backups:", error);
      throw error;
    }
  }

  // Delete backup
  async deleteBackup(backupName) {
    try {
      const backupPath = path.join(this.backupDir, backupName);
      const compressedPath = `${backupPath}.tar.gz`;
      const metadataPath = `${backupPath}_metadata.json`;

      // Delete backup files
      try {
        await fs.unlink(compressedPath);
      } catch (error) {
        try {
          await fs.rmdir(backupPath, { recursive: true });
        } catch (innerError) {
          // File might not exist
        }
      }

      // Delete metadata
      try {
        await fs.unlink(metadataPath);
      } catch (error) {
        // Metadata might not exist
      }

      logger.info(`Backup deleted: ${backupName}`);

      return { success: true, deleted: backupName };
    } catch (error) {
      logger.error("Failed to delete backup:", error);
      throw error;
    }
  }

  // Validate backup integrity
  async validateBackup(backupName) {
    try {
      const metadata = await this.getBackupMetadata(backupName);

      if (!metadata) {
        return { valid: false, error: "Metadata not found" };
      }

      const backupPath = path.join(this.backupDir, backupName);
      const actualPath = metadata.compressed
        ? `${backupPath}.tar.gz`
        : backupPath;

      // Check if backup file exists
      try {
        await fs.access(actualPath);
      } catch (error) {
        return { valid: false, error: "Backup file not found" };
      }

      // Verify file size
      const stats = await fs.stat(actualPath);
      const sizeDifference = Math.abs(stats.size - metadata.size);
      const sizeThreshold = metadata.size * 0.1; // 10% tolerance

      if (sizeDifference > sizeThreshold) {
        return {
          valid: false,
          error: "File size mismatch",
          expected: metadata.size,
          actual: stats.size,
        };
      }

      return {
        valid: true,
        metadata,
        fileSize: stats.size,
        verified: new Date(),
      };
    } catch (error) {
      logger.error("Backup validation failed:", error);
      return { valid: false, error: error.message };
    }
  }

  // Helper methods
  async compressBackup(sourcePath, targetPath) {
    const command = `tar -czf "${targetPath}" -C "${path.dirname(
      sourcePath
    )}" "${path.basename(sourcePath)}"`;
    await execAsync(command);
  }

  async extractBackup(sourcePath, targetPath) {
    const command = `tar -xzf "${sourcePath}" -C "${path.dirname(targetPath)}"`;
    await execAsync(command);
  }

  async getBackupSize(backupPath) {
    try {
      const stats = await fs.stat(backupPath);
      return stats.isDirectory()
        ? await this.getDirSize(backupPath)
        : stats.size;
    } catch (error) {
      return 0;
    }
  }

  async getDirSize(dirPath) {
    let totalSize = 0;
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        totalSize += await this.getDirSize(filePath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  async saveBackupMetadata(backupName, metadata) {
    const metadataPath = path.join(
      this.backupDir,
      `${backupName}_metadata.json`
    );
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async getBackupMetadata(backupName) {
    try {
      const metadataPath = path.join(
        this.backupDir,
        `${backupName}_metadata.json`
      );
      const metadata = await fs.readFile(metadataPath, "utf8");
      return JSON.parse(metadata);
    } catch (error) {
      return null;
    }
  }

  async getLastBackupTime() {
    try {
      const cacheKey = "last_backup_time";
      const cached = await cacheService.get(cacheKey);
      return cached ? new Date(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async updateLastBackupTime() {
    const cacheKey = "last_backup_time";
    await cacheService.set(
      cacheKey,
      new Date().toISOString(),
      30 * 24 * 60 * 60
    ); // 30 days
  }

  async getChangedDocuments(collectionName, since) {
    const collection = mongoose.connection.collection(collectionName);
    return await collection
      .find({
        $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }],
      })
      .toArray();
  }

  async getCollectionStats() {
    const stats = {};
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      const collectionStats = await mongoose.connection.db
        .collection(collection.name)
        .stats();
      stats[collection.name] = {
        count: collectionStats.count || 0,
        size: collectionStats.size || 0,
        avgObjSize: collectionStats.avgObjSize || 0,
      };
    }

    return stats;
  }

  async getMongoVersion() {
    try {
      const admin = mongoose.connection.db.admin();
      const result = await admin.buildInfo();
      return result.version;
    } catch (error) {
      return "unknown";
    }
  }

  extractDbName(mongoUri) {
    const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : "olympia";
  }

  async convertToCSV(documents) {
    if (documents.length === 0) return "";

    const headers = Object.keys(documents[0]);
    const csvContent = [
      headers.join(","),
      ...documents.map((doc) =>
        headers.map((header) => JSON.stringify(doc[header] || "")).join(",")
      ),
    ].join("\n");

    return csvContent;
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();

      if (backups.length > this.maxBackups) {
        const backupsToDelete = backups.slice(this.maxBackups);

        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.name);
        }

        logger.info(`Cleaned up ${backupsToDelete.length} old backups`);
      }
    } catch (error) {
      logger.error("Failed to cleanup old backups:", error);
    }
  }

  // Scheduled backup tasks
  startScheduledBackups() {
    // Daily backup at 2 AM
    cron.schedule("0 2 * * *", async () => {
      try {
        logger.info("Running scheduled daily backup");
        await this.createDatabaseBackup({ type: "daily" });
        await this.updateLastBackupTime();
      } catch (error) {
        logger.error("Scheduled daily backup failed:", error);
      }
    });

    // Weekly full backup on Sundays at 3 AM
    cron.schedule("0 3 * * 0", async () => {
      try {
        logger.info("Running scheduled weekly backup");
        await this.createDatabaseBackup({
          type: "weekly",
          compress: true,
          includeIndexes: true,
        });
      } catch (error) {
        logger.error("Scheduled weekly backup failed:", error);
      }
    });

    // Hourly incremental backup during business hours
    cron.schedule("0 9-17 * * 1-5", async () => {
      try {
        logger.info("Running scheduled incremental backup");
        await this.createIncrementalBackup();
      } catch (error) {
        logger.error("Scheduled incremental backup failed:", error);
      }
    });

    // Monthly cleanup on first day of month at 4 AM
    cron.schedule("0 4 1 * *", async () => {
      try {
        logger.info("Running monthly backup cleanup");
        await this.cleanupOldBackups();
      } catch (error) {
        logger.error("Monthly backup cleanup failed:", error);
      }
    });
  }
}

module.exports = new BackupService();
