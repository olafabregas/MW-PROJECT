const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth");
const healthService = require("../services/healthService");
const analyticsService = require("../services/analyticsService");
const backupService = require("../services/backupService");
const { logger } = require("../utils/logger");

// Health monitoring routes
router.get(
  "/health/system",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const health = await healthService.getSystemHealth();
      res.json(health);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/health/history",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { period = "1h" } = req.query;
      const history = healthService.getHealthHistory(period);
      res.json({ history, period });
    } catch (error) {
      next(error);
    }
  }
);

// Analytics routes
router.get(
  "/analytics/dashboard",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const stats = await analyticsService.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/analytics/users",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { period = 30 } = req.query;
      const analytics = await analyticsService.getUserAnalytics(
        parseInt(period)
      );
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/analytics/content",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { period = 30 } = req.query;
      const analytics = await analyticsService.getContentAnalytics(
        parseInt(period)
      );
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/analytics/performance",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const analytics = await analyticsService.getPerformanceAnalytics();
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  }
);

// Backup management routes
router.get("/backups", protect, restrictTo("admin"), async (req, res, next) => {
  try {
    const backups = await backupService.listBackups();
    res.json({ backups });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/backups/create",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const {
        type = "manual",
        compress = true,
        includeIndexes = true,
      } = req.body;

      logger.info(`Admin ${req.user.username} initiated ${type} backup`);

      const result = await backupService.createDatabaseBackup({
        type,
        compress,
        includeIndexes,
      });

      res.json({
        message: "Backup created successfully",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/backups/incremental",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      logger.info(`Admin ${req.user.username} initiated incremental backup`);

      const result = await backupService.createIncrementalBackup();

      res.json({
        message: "Incremental backup created successfully",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/backups/restore/:backupName",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { backupName } = req.params;
      const {
        dropBeforeRestore = false,
        restoreIndexes = true,
        dryRun = false,
      } = req.body;

      logger.warn(
        `Admin ${req.user.username} initiated restore from backup: ${backupName}`
      );

      const result = await backupService.restoreFromBackup(backupName, {
        dropBeforeRestore,
        restoreIndexes,
        dryRun,
      });

      res.json({
        message: dryRun
          ? "Restore validation completed"
          : "Database restored successfully",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/backups/validate/:backupName",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { backupName } = req.params;
      const validation = await backupService.validateBackup(backupName);
      res.json(validation);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/backups/:backupName",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { backupName } = req.params;

      logger.info(`Admin ${req.user.username} deleted backup: ${backupName}`);

      const result = await backupService.deleteBackup(backupName);
      res.json({
        message: "Backup deleted successfully",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export collections
router.post("/export", protect, restrictTo("admin"), async (req, res, next) => {
  try {
    const { collections, format = "json" } = req.body;

    if (!collections || !Array.isArray(collections)) {
      return res.status(400).json({
        error: "Collections array is required",
      });
    }

    logger.info(
      `Admin ${
        req.user.username
      } initiated export of collections: ${collections.join(", ")}`
    );

    const result = await backupService.exportCollections(collections, format);

    res.json({
      message: "Collections exported successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// System maintenance routes
router.post(
  "/maintenance/start",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const { message, duration } = req.body;

      // Set maintenance mode flag
      global.maintenanceMode = {
        active: true,
        message: message || "System maintenance in progress",
        startTime: new Date(),
        estimatedEnd: duration ? new Date(Date.now() + duration * 60000) : null,
        initiatedBy: req.user.username,
      };

      logger.warn(`Maintenance mode started by ${req.user.username}`);

      res.json({
        message: "Maintenance mode activated",
        maintenanceInfo: global.maintenanceMode,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/maintenance/stop",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      if (global.maintenanceMode) {
        const duration =
          Date.now() - new Date(global.maintenanceMode.startTime).getTime();
        logger.info(
          `Maintenance mode ended by ${
            req.user.username
          }. Duration: ${Math.round(duration / 60000)} minutes`
        );
      }

      global.maintenanceMode = null;

      res.json({
        message: "Maintenance mode deactivated",
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/maintenance/status", async (req, res) => {
  res.json({
    maintenanceMode: global.maintenanceMode || { active: false },
  });
});

// System information
router.get(
  "/system/info",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const systemInfo = {
        server: {
          platform: process.platform,
          architecture: process.arch,
          nodeVersion: process.version,
          uptime: process.uptime(),
          pid: process.pid,
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT,
          // Don't expose sensitive environment variables
          hasMongoUri: !!process.env.MONGODB_URI,
          hasJwtSecret: !!process.env.JWT_SECRET,
          hasTmdbKey: !!process.env.TMDB_API_KEY,
        },
        database: {
          readyState: require("mongoose").connection.readyState,
          host: require("mongoose").connection.host,
          name: require("mongoose").connection.name,
        },
      };

      res.json(systemInfo);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
