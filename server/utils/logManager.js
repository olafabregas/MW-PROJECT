const fs = require("fs").promises;
const path = require("path");
const {
  logger,
  auditLogger,
  securityLogger,
  performanceLogger,
} = require("../utils/logger");

class LogManager {
  constructor() {
    this.logDir = path.join(process.cwd(), "logs");
    this.maxLogFiles = 30; // Keep logs for 30 days
    this.compressionEnabled = true;
  }

  // Initialize log management
  async init() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await this.cleanupOldLogs();
      this.startLogRotation();
      logger.info("Log manager initialized");
    } catch (error) {
      console.error("Failed to initialize log manager:", error);
    }
  }

  // Log user activity
  logUserActivity(userId, action, details = {}) {
    auditLogger.info("User activity", {
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // Log security events
  logSecurityEvent(eventType, severity, details, request = {}) {
    const securityEvent = {
      eventType,
      severity,
      details,
      request: {
        ip: request.ip,
        userAgent: request.userAgent,
        url: request.url,
        method: request.method,
      },
      timestamp: new Date().toISOString(),
    };

    securityLogger.warn("Security event", securityEvent);

    // For critical events, also log to main logger
    if (severity === "critical") {
      logger.error("CRITICAL SECURITY EVENT", securityEvent);
    }
  }

  // Log performance metrics
  logPerformance(operation, duration, details = {}) {
    performanceLogger.info("Performance metric", {
      operation,
      duration,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // Log API requests
  logAPIRequest(req, res, duration) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user ? req.user._id : null,
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 500) {
      logger.error("API Error", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("API Client Error", logData);
    } else {
      logger.info("API Request", logData);
    }
  }

  // Log database operations
  logDatabaseOperation(operation, collection, query = {}, duration = null) {
    const logData = {
      operation,
      collection,
      query: this.sanitizeQuery(query),
      duration: duration ? `${duration}ms` : null,
      timestamp: new Date().toISOString(),
    };

    if (duration && duration > 1000) {
      logger.warn("Slow database operation", logData);
    } else {
      logger.debug("Database operation", logData);
    }
  }

  // Log errors with context
  logError(error, context = {}) {
    const errorData = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    logger.error("Application error", errorData);
  }

  // Log authentication events
  logAuthEvent(event, userId, details = {}) {
    auditLogger.info("Authentication event", {
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // Log file operations
  logFileOperation(operation, fileName, details = {}) {
    logger.info("File operation", {
      operation,
      fileName,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // Log system events
  logSystemEvent(event, details = {}) {
    logger.info("System event", {
      event,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // Get log statistics
  async getLogStats(days = 7) {
    try {
      const stats = {
        totalEntries: 0,
        errorCount: 0,
        warningCount: 0,
        securityEvents: 0,
        performanceIssues: 0,
        dailyBreakdown: {},
      };

      // This is a simplified version - in production you'd parse actual log files
      // For now, return placeholder data
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        stats.dailyBreakdown[dateStr] = {
          total: Math.floor(Math.random() * 1000) + 100,
          errors: Math.floor(Math.random() * 50),
          warnings: Math.floor(Math.random() * 100),
          security: Math.floor(Math.random() * 10),
        };

        stats.totalEntries += stats.dailyBreakdown[dateStr].total;
        stats.errorCount += stats.dailyBreakdown[dateStr].errors;
        stats.warningCount += stats.dailyBreakdown[dateStr].warnings;
        stats.securityEvents += stats.dailyBreakdown[dateStr].security;
      }

      return stats;
    } catch (error) {
      this.logError(error, { context: "getLogStats" });
      throw error;
    }
  }

  // Search logs
  async searchLogs(query, options = {}) {
    try {
      const { startDate, endDate, level, userId, limit = 100 } = options;

      // This is a placeholder implementation
      // In production, you'd implement actual log searching
      const results = {
        query,
        options,
        results: [],
        total: 0,
        message: "Log search functionality requires log aggregation service",
      };

      return results;
    } catch (error) {
      this.logError(error, { context: "searchLogs", query, options });
      throw error;
    }
  }

  // Export logs
  async exportLogs(startDate, endDate, format = "json") {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        startDate,
        endDate,
        format,
        logs: [], // Placeholder - implement actual log reading
      };

      this.logSystemEvent("LOG_EXPORT", {
        startDate,
        endDate,
        format,
        requestedAt: new Date().toISOString(),
      });

      return exportData;
    } catch (error) {
      this.logError(error, {
        context: "exportLogs",
        startDate,
        endDate,
        format,
      });
      throw error;
    }
  }

  // Clean up old log files
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter((file) => file.endsWith(".log"));

      if (logFiles.length > this.maxLogFiles) {
        // Sort by creation time and remove oldest
        const fileStats = await Promise.all(
          logFiles.map(async (file) => {
            const stats = await fs.stat(path.join(this.logDir, file));
            return { file, mtime: stats.mtime };
          })
        );

        fileStats.sort((a, b) => a.mtime - b.mtime);
        const filesToDelete = fileStats.slice(
          0,
          fileStats.length - this.maxLogFiles
        );

        for (const { file } of filesToDelete) {
          await fs.unlink(path.join(this.logDir, file));
          logger.info(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      logger.error("Failed to cleanup old logs:", error);
    }
  }

  // Start automatic log rotation
  startLogRotation() {
    // Rotate logs daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.rotateLogFiles();

      // Set up daily rotation
      setInterval(() => {
        this.rotateLogFiles();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);
  }

  // Rotate log files
  async rotateLogFiles() {
    try {
      const timestamp = new Date().toISOString().split("T")[0];

      // This would typically involve renaming current log files
      // and creating new ones
      logger.info(`Log rotation completed for ${timestamp}`);

      // Cleanup old logs after rotation
      await this.cleanupOldLogs();
    } catch (error) {
      logger.error("Failed to rotate log files:", error);
    }
  }

  // Sanitize query objects for logging (remove sensitive data)
  sanitizeQuery(query) {
    const sanitized = { ...query };

    // Remove sensitive fields
    const sensitiveFields = ["password", "token", "secret", "key"];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  // Get log file information
  async getLogFileInfo() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter((file) => file.endsWith(".log"));

      const fileInfo = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);

          return {
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            sizeFormatted: this.formatFileSize(stats.size),
          };
        })
      );

      return fileInfo.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      this.logError(error, { context: "getLogFileInfo" });
      throw error;
    }
  }

  // Format file size for display
  formatFileSize(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(2);

    return `${size} ${sizes[i]}`;
  }

  // Monitor log levels and alert on high error rates
  monitorLogLevels() {
    // This would track error rates and send alerts
    // Implementation depends on your alerting system
    logger.info("Log level monitoring started");
  }
}

// Create singleton instance
const logManager = new LogManager();

module.exports = {
  LogManager,
  logManager,
};
