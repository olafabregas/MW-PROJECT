const express = require("express");
const router = express.Router();
const ApplicationLog = require("../models/ApplicationLog");
const { auth } = require("../middleware/auth");
const { body, query, validationResult } = require("express-validator");
const databaseLogger = require("../utils/databaseLogger");

// Middleware to check admin permissions for sensitive log operations
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      await databaseLogger.logSecurity(
        "UNAUTHORIZED_LOG_ACCESS",
        "medium",
        {
          userId: req.user?._id,
          attemptedEndpoint: req.originalUrl,
          userRole: req.user?.role,
        },
        req
      );

      return res.status(403).json({
        message: "Admin access required for log operations",
        error: "INSUFFICIENT_PERMISSIONS",
      });
    }
    next();
  } catch (error) {
    await databaseLogger.logError(
      "Admin check failed in logs route",
      error,
      req
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/logs - Search and filter logs
router.get(
  "/",
  auth,
  requireAdmin,
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be between 1 and 1000"),
    query("level")
      .optional()
      .isIn(["error", "warn", "info", "debug", "verbose"])
      .withMessage("Invalid log level"),
    query("category")
      .optional()
      .isIn([
        "application",
        "security",
        "audit",
        "performance",
        "api",
        "database",
        "authentication",
        "system",
      ])
      .withMessage("Invalid category"),
    query("severity")
      .optional()
      .isIn(["low", "medium", "high", "critical"])
      .withMessage("Invalid severity"),
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be valid ISO date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be valid ISO date"),
    query("search")
      .optional()
      .isLength({ min: 1, max: 500 })
      .withMessage("Search query must be 1-500 characters"),
    query("userId")
      .optional()
      .isMongoId()
      .withMessage("User ID must be valid MongoDB ObjectId"),
    query("ipAddress")
      .optional()
      .isIP()
      .withMessage("IP address must be valid"),
    query("sortBy")
      .optional()
      .isIn(["createdAt", "level", "category", "severity"])
      .withMessage("Invalid sort field"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc", "1", "-1"])
      .withMessage("Sort order must be asc, desc, 1, or -1"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        page = 1,
        limit = 50,
        level,
        category,
        severity,
        startDate,
        endDate,
        search,
        userId,
        ipAddress,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Convert sortOrder to number
      const order = sortOrder === "asc" || sortOrder === "1" ? 1 : -1;

      // Build search options
      const searchOptions = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: order,
      };

      if (level) searchOptions.level = level;
      if (category) searchOptions.category = category;
      if (severity) searchOptions.severity = severity;
      if (userId) searchOptions.userId = userId;
      if (ipAddress) searchOptions.ipAddress = ipAddress;
      if (search) searchOptions.query = search;
      if (startDate) searchOptions.startDate = startDate;
      if (endDate) searchOptions.endDate = endDate;

      // Log the search operation
      await databaseLogger.logAudit(
        "LOG_SEARCH",
        {
          searchCriteria: searchOptions,
          adminUser: req.user._id,
        },
        req
      );

      // Search logs using the model's static method
      const result = await ApplicationLog.searchLogs(searchOptions);

      res.json({
        success: true,
        data: result,
        meta: {
          searchCriteria: searchOptions,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      await databaseLogger.logError("Failed to search logs", error, req);
      res.status(500).json({
        message: "Failed to retrieve logs",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }
);

// GET /api/logs/stats - Get log statistics and analytics
router.get("/stats", auth, requireAdmin, async (req, res) => {
  try {
    const { days = 7, category, level, userId } = req.query;

    const startDate = new Date(
      Date.now() - parseInt(days) * 24 * 60 * 60 * 1000
    );
    const endDate = new Date();

    const options = { startDate, endDate };
    if (category) options.category = category;
    if (level) options.level = level;
    if (userId) options.userId = userId;

    // Get various statistics
    const [logStats, errorPatterns, performanceMetrics, securityInsights] =
      await Promise.all([
        ApplicationLog.getLogStats(options),
        ApplicationLog.getErrorPatterns({ startDate }),
        ApplicationLog.getPerformanceMetrics({ startDate }),
        ApplicationLog.getSecurityInsights({ startDate }),
      ]);

    // Calculate summary statistics
    const totalLogs = await ApplicationLog.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const errorCount = await ApplicationLog.countDocuments({
      level: "error",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const criticalCount = await ApplicationLog.countDocuments({
      severity: "critical",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    await databaseLogger.logAudit(
      "LOG_STATS_ACCESSED",
      {
        timeRange: { startDate, endDate },
        adminUser: req.user._id,
      },
      req
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalLogs,
          errorCount,
          criticalCount,
          errorRate:
            totalLogs > 0 ? ((errorCount / totalLogs) * 100).toFixed(2) : 0,
          period: `${days} days`,
        },
        trends: logStats,
        errorPatterns,
        performance: performanceMetrics,
        security: securityInsights,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        timeRange: { startDate, endDate },
      },
    });
  } catch (error) {
    await databaseLogger.logError("Failed to get log statistics", error, req);
    res.status(500).json({
      message: "Failed to retrieve log statistics",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// GET /api/logs/export - Export logs
router.get("/export", auth, requireAdmin, async (req, res) => {
  try {
    const {
      format = "json",
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate = new Date(),
      level,
      category,
      limit = 1000,
    } = req.query;

    const query = {
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };

    if (level) query.level = level;
    if (category) query.category = category;

    const logs = await ApplicationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("userId", "email username")
      .lean();

    await databaseLogger.logAudit(
      "LOG_EXPORT",
      {
        format,
        recordCount: logs.length,
        criteria: query,
        adminUser: req.user._id,
      },
      req
    );

    if (format === "csv") {
      const csvHeader =
        "Timestamp,Level,Category,Message,User,IP Address,Source\n";
      const csvData = logs
        .map((log) => {
          const timestamp = log.createdAt.toISOString();
          const level = log.level;
          const category = log.category;
          const message = `"${log.message.replace(/"/g, '""')}"`;
          const user = log.userId
            ? log.userId.email || log.userId.username || log.userId._id
            : "";
          const ip = log.ipAddress || "";
          const source = log.source || "";

          return `${timestamp},${level},${category},${message},${user},${ip},${source}`;
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="logs-export-${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(csvHeader + csvData);
    } else {
      res.json({
        export: {
          generatedAt: new Date().toISOString(),
          criteria: query,
          recordCount: logs.length,
          data: logs,
        },
      });
    }
  } catch (error) {
    await databaseLogger.logError("Failed to export logs", error, req);
    res.status(500).json({
      message: "Failed to export logs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// POST /api/logs/cleanup - Clean up old logs
router.post("/cleanup", auth, requireAdmin, async (req, res) => {
  try {
    const { days, categories, levels, dryRun = false } = req.body;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deleteQuery = {
      createdAt: { $lt: cutoffDate },
    };

    if (categories && categories.length > 0) {
      deleteQuery.category = { $in: categories };
    }

    if (levels && levels.length > 0) {
      deleteQuery.level = { $in: levels };
    }

    const logsToDelete = await ApplicationLog.countDocuments(deleteQuery);

    if (dryRun) {
      await databaseLogger.logAudit(
        "LOG_CLEANUP_DRY_RUN",
        {
          criteria: deleteQuery,
          logsToDelete,
          adminUser: req.user._id,
        },
        req
      );

      return res.json({
        success: true,
        dryRun: true,
        message: `Would delete ${logsToDelete} logs`,
        criteria: deleteQuery,
        logsToDelete,
      });
    }

    const deleteResult = await ApplicationLog.deleteMany(deleteQuery);

    await databaseLogger.logAudit(
      "LOG_CLEANUP_EXECUTED",
      {
        criteria: deleteQuery,
        deletedCount: deleteResult.deletedCount,
        adminUser: req.user._id,
      },
      req
    );

    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} logs`,
      deletedCount: deleteResult.deletedCount,
      criteria: deleteQuery,
    });
  } catch (error) {
    await databaseLogger.logError("Failed to cleanup logs", error, req);
    res.status(500).json({
      message: "Failed to cleanup logs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// GET /api/logs/:id - Get specific log entry
router.get("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const log = await ApplicationLog.findById(id)
      .populate("userId", "email username")
      .lean();

    if (!log) {
      return res.status(404).json({
        message: "Log entry not found",
      });
    }

    // Find related logs if correlation ID exists
    let relatedLogs = [];
    if (log.correlationId) {
      relatedLogs = await ApplicationLog.find({
        correlationId: log.correlationId,
        _id: { $ne: log._id },
      })
        .populate("userId", "email username")
        .sort({ createdAt: 1 })
        .lean();
    }

    await databaseLogger.logAudit(
      "LOG_DETAIL_ACCESSED",
      {
        logId: id,
        adminUser: req.user._id,
      },
      req
    );

    res.json({
      success: true,
      data: {
        log,
        relatedLogs,
      },
    });
  } catch (error) {
    await databaseLogger.logError("Failed to get log details", error, req);
    res.status(500).json({
      message: "Failed to retrieve log details",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

module.exports = router;
