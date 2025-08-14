const ApplicationLog = require("../models/ApplicationLog");
const SecurityLog = require("../models/SecurityLog");
const winston = require("winston");
const crypto = require("crypto");

class DatabaseLogger {
  constructor() {
    this.batchSize = 50;
    this.batchTimeout = 5000; // 5 seconds
    this.logQueue = [];
    this.isProcessing = false;
    this.requestContext = new Map();

    // Start batch processing
    this.startBatchProcessor();

    // Performance monitoring
    this.performanceMetrics = {
      totalLogs: 0,
      avgWriteTime: 0,
      errors: 0,
    };
  }

  // Generate unique request ID for correlation
  generateRequestId() {
    return crypto.randomBytes(16).toString("hex");
  }

  // Set request context for correlation
  setRequestContext(requestId, context) {
    this.requestContext.set(requestId, {
      ...context,
      timestamp: Date.now(),
    });

    // Auto-cleanup old contexts (older than 1 hour)
    setTimeout(() => {
      this.requestContext.delete(requestId);
    }, 3600000);
  }

  // Get request context
  getRequestContext(requestId) {
    return this.requestContext.get(requestId);
  }

  // Main logging method
  async log(level, message, options = {}) {
    try {
      const logEntry = this.createLogEntry(level, message, options);

      // For critical logs, write immediately
      if (
        level === "error" ||
        options.severity === "critical" ||
        options.immediate
      ) {
        return await this.writeLogToDB(logEntry);
      }

      // Add to batch queue for other logs
      this.addToBatch(logEntry);
    } catch (error) {
      // Fallback to console logging if database logging fails
      console.error("Database logging failed:", error);
      console.log(`[${level.toUpperCase()}] ${message}`, options);
    }
  }

  // Create standardized log entry
  createLogEntry(level, message, options = {}) {
    const {
      category = "application",
      userId,
      sessionId,
      ipAddress,
      userAgent,
      requestId,
      metadata = {},
      stack,
      duration,
      statusCode,
      method,
      url,
      query,
      collection,
      operation,
      severity,
      tags = [],
      source,
      correlationId,
    } = options;

    // Enrich with request context if available
    let enrichedMetadata = { ...metadata };
    if (requestId) {
      const context = this.getRequestContext(requestId);
      if (context) {
        enrichedMetadata = { ...enrichedMetadata, ...context };
      }
    }

    return {
      level,
      message,
      category,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      requestId,
      metadata: enrichedMetadata,
      stack,
      duration,
      statusCode,
      method,
      url,
      query,
      dbCollection: collection,
      operation,
      severity,
      tags,
      source,
      correlationId,
      environment: process.env.NODE_ENV || "development",
    };
  }

  // Add log to batch queue
  addToBatch(logEntry) {
    this.logQueue.push(logEntry);

    // Process immediately if batch is full
    if (this.logQueue.length >= this.batchSize) {
      this.processBatch();
    }
  }

  // Start batch processor
  startBatchProcessor() {
    setInterval(() => {
      if (this.logQueue.length > 0 && !this.isProcessing) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  // Process batch of logs
  async processBatch() {
    if (this.isProcessing || this.logQueue.length === 0) return;

    this.isProcessing = true;
    const batch = this.logQueue.splice(0, this.batchSize);

    try {
      const startTime = Date.now();
      await ApplicationLog.insertMany(batch, { ordered: false });

      const writeTime = Date.now() - startTime;
      this.updatePerformanceMetrics(batch.length, writeTime);
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error("Batch logging failed:", error);

      // Try individual inserts for failed batch
      await this.fallbackIndividualInserts(batch);
    } finally {
      this.isProcessing = false;
    }
  }

  // Fallback to individual inserts if batch fails
  async fallbackIndividualInserts(batch) {
    for (const logEntry of batch) {
      try {
        await this.writeLogToDB(logEntry);
      } catch (error) {
        console.error("Individual log insert failed:", error);
      }
    }
  }

  // Write single log to database
  async writeLogToDB(logEntry) {
    const startTime = Date.now();

    try {
      const log = new ApplicationLog(logEntry);
      await log.save();

      const writeTime = Date.now() - startTime;
      this.updatePerformanceMetrics(1, writeTime);

      return log;
    } catch (error) {
      this.performanceMetrics.errors++;
      throw error;
    }
  }

  // Update performance metrics
  updatePerformanceMetrics(count, writeTime) {
    this.performanceMetrics.totalLogs += count;

    // Calculate rolling average write time
    const currentAvg = this.performanceMetrics.avgWriteTime;
    const totalOperations = this.performanceMetrics.totalLogs / count;
    this.performanceMetrics.avgWriteTime =
      (currentAvg * (totalOperations - 1) + writeTime / count) /
      totalOperations;
  }

  // Convenience methods for different log levels
  async logError(message, error, req = null) {
    const options = {
      category: "application",
      severity: "high",
      immediate: true,
      stack: error ? error.stack : undefined,
      metadata: error ? { name: error.name, message: error.message } : {},
    };

    if (req) {
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    return await this.log("error", message, options);
  }

  async logSystem(event, metadata = {}, req = null) {
    const options = {
      category: "system",
      severity: "low",
      metadata,
      tags: ["system", event],
    };

    if (req) {
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    return await this.log("info", `System event: ${event}`, options);
  }

  async logSecurity(eventType, severity = "medium", metadata = {}, req = null) {
    const options = {
      category: "security",
      severity,
      eventType,
      metadata,
      immediate: severity === "critical",
      tags: ["security", eventType],
    };

    if (req) {
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    // Also create SecurityLog entry for security events
    try {
      await SecurityLog.create({
        eventType,
        severity,
        message: `Security event: ${eventType}`,
        userId: options.userId,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        metadata,
        riskScore: severity === "critical" ? 90 : severity === "high" ? 70 : 50,
        source: "system",
      });
    } catch (error) {
      console.error("SecurityLog creation failed:", error);
    }

    return await this.log("warn", `Security event: ${eventType}`, options);
  }

  async logAudit(action, metadata = {}, req = null) {
    const options = {
      category: "audit",
      severity: "medium",
      metadata: { action, ...metadata },
      tags: ["audit", action],
    };

    if (req) {
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    return await this.log("info", `Audit: ${action}`, options);
  }

  async logPerformance(operation, duration, metadata = {}, req = null) {
    const options = {
      category: "performance",
      operation,
      duration,
      severity: duration > 1000 ? "medium" : "low",
      metadata,
      tags: ["performance", operation],
    };

    if (req) {
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    const level = duration > 5000 ? "warn" : "info";
    return await this.log(
      level,
      `Performance: ${operation} completed in ${duration}ms`,
      options
    );
  }

  async logAPI(event, metadata = {}, req = null) {
    const options = {
      category: "api",
      severity: "low",
      metadata,
      tags: ["api", event],
    };

    if (req) {
      options.method = req.method;
      options.url = req.originalUrl;
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    return await this.log("info", `API: ${event}`, options);
  }

  async logDatabase(operation, collection, metadata = {}, req = null) {
    const options = {
      category: "database",
      operation,
      dbCollection: collection,
      severity: "low",
      metadata,
      tags: ["database", operation, collection],
    };

    if (req) {
      options.ipAddress = req.ip;
      options.userAgent = req.get ? req.get("User-Agent") : req.userAgent;
      options.requestId = req.requestId;
      options.userId = req.user ? req.user._id : null;
    }

    return await this.log(
      "debug",
      `Database: ${operation} on ${collection}`,
      options
    );
  }

  // Legacy convenience methods
  async error(message, options = {}) {
    return await this.log("error", message, {
      ...options,
      category: options.category || "application",
      severity: options.severity || "high",
      immediate: true,
    });
  }

  async warn(message, options = {}) {
    return await this.log("warn", message, {
      ...options,
      category: options.category || "application",
      severity: options.severity || "medium",
    });
  }

  async info(message, options = {}) {
    return await this.log("info", message, {
      ...options,
      category: options.category || "application",
      severity: options.severity || "low",
    });
  }

  async debug(message, options = {}) {
    return await this.log("debug", message, {
      ...options,
      category: options.category || "application",
      severity: options.severity || "low",
    });
  }

  // Security-specific logging
  async security(message, options = {}) {
    const securityOptions = {
      ...options,
      category: "security",
      severity: options.severity || "medium",
      immediate: options.severity === "critical",
    };

    // Also create SecurityLog entry for security events
    if (options.eventType) {
      try {
        await SecurityLog.create({
          eventType: options.eventType,
          severity: options.severity || "medium",
          message,
          userId: options.userId,
          sessionId: options.sessionId,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          metadata: options.metadata || {},
          riskScore: options.riskScore || 50,
          source: options.source || "system",
        });
      } catch (error) {
        console.error("SecurityLog creation failed:", error);
      }
    }

    return await this.log("warn", message, securityOptions);
  }

  // Performance logging
  async performance(operation, duration, options = {}) {
    const performanceOptions = {
      ...options,
      category: "performance",
      operation,
      duration,
      severity: duration > 1000 ? "medium" : "low",
      tags: [...(options.tags || []), "performance", operation],
    };

    const level = duration > 5000 ? "warn" : "info";
    return await this.log(
      level,
      `${operation} completed in ${duration}ms`,
      performanceOptions
    );
  }

  // API request logging
  async apiRequest(req, res, duration, options = {}) {
    const apiOptions = {
      ...options,
      category: "api",
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user ? req.user._id : null,
      sessionId: req.sessionId,
      requestId: req.requestId,
      metadata: {
        query: req.query,
        params: req.params,
        body:
          req.method === "POST" || req.method === "PUT"
            ? this.sanitizeRequestBody(req.body)
            : undefined,
        ...options.metadata,
      },
      tags: ["api", req.method.toLowerCase(), ...(options.tags || [])],
    };

    let level = "info";
    let severity = "low";

    if (res.statusCode >= 500) {
      level = "error";
      severity = "high";
    } else if (res.statusCode >= 400) {
      level = "warn";
      severity = "medium";
    } else if (duration > 2000) {
      level = "warn";
      severity = "medium";
    }

    return await this.log(
      level,
      `${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`,
      { ...apiOptions, severity }
    );
  }

  // Database operation logging
  async database(
    operation,
    collection,
    query = {},
    duration = null,
    options = {}
  ) {
    const dbOptions = {
      ...options,
      category: "database",
      operation,
      collection,
      query: this.sanitizeQuery(query),
      duration,
      severity: duration && duration > 1000 ? "medium" : "low",
      tags: ["database", operation, collection, ...(options.tags || [])],
    };

    const level = duration && duration > 5000 ? "warn" : "debug";
    const message = duration
      ? `${operation} on ${collection} completed in ${duration}ms`
      : `${operation} on ${collection}`;

    return await this.log(level, message, dbOptions);
  }

  // Authentication logging
  async authentication(event, userId, options = {}) {
    const authOptions = {
      ...options,
      category: "authentication",
      userId,
      severity:
        event.includes("failed") || event.includes("locked") ? "medium" : "low",
      tags: ["auth", event, ...(options.tags || [])],
    };

    return await this.log(
      "info",
      `Authentication event: ${event}`,
      authOptions
    );
  }

  // System event logging
  async system(event, options = {}) {
    const systemOptions = {
      ...options,
      category: "system",
      severity: options.severity || "low",
      tags: ["system", event, ...(options.tags || [])],
    };

    return await this.log("info", `System event: ${event}`, systemOptions);
  }

  // Audit logging
  async audit(action, userId, target, options = {}) {
    const auditOptions = {
      ...options,
      category: "audit",
      userId,
      severity: "medium",
      metadata: {
        action,
        target,
        ...options.metadata,
      },
      tags: ["audit", action, ...(options.tags || [])],
    };

    return await this.log(
      "info",
      `Audit: ${action} on ${target}`,
      auditOptions
    );
  }

  // Utility methods
  sanitizeRequestBody(body) {
    if (!body) return undefined;

    const sanitized = { ...body };
    const sensitiveFields = ["password", "token", "secret", "key", "auth"];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  sanitizeQuery(query) {
    if (!query) return {};

    try {
      const sanitized = JSON.parse(JSON.stringify(query));

      // Remove sensitive data
      if (sanitized.password) sanitized.password = "[REDACTED]";
      if (sanitized.token) sanitized.token = "[REDACTED]";

      return sanitized;
    } catch (error) {
      return { error: "Unable to serialize query" };
    }
  }

  // Analytics and reporting methods
  async getLogStatistics(options = {}) {
    return await ApplicationLog.getLogStats(options);
  }

  async getErrorPatterns(options = {}) {
    return await ApplicationLog.getErrorPatterns(options);
  }

  async getPerformanceMetrics(options = {}) {
    return await ApplicationLog.getPerformanceMetrics(options);
  }

  async getSecurityInsights(options = {}) {
    return await ApplicationLog.getSecurityInsights(options);
  }

  async searchLogs(searchOptions = {}) {
    return await ApplicationLog.searchLogs(searchOptions);
  }

  // Health check
  async healthCheck() {
    try {
      const testLog = await this.info("Database logger health check", {
        source: "DatabaseLogger",
        tags: ["health-check"],
      });

      return {
        status: "healthy",
        metrics: this.performanceMetrics,
        queueSize: this.logQueue.length,
        isProcessing: this.isProcessing,
        testLogId: testLog._id,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        metrics: this.performanceMetrics,
      };
    }
  }

  // Cleanup old logs
  async cleanup(options = {}) {
    const {
      olderThan = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
      categories = [],
      dryRun = false,
    } = options;

    const query = { createdAt: { $lt: olderThan } };
    if (categories.length > 0) {
      query.category = { $in: categories };
    }

    if (dryRun) {
      const count = await ApplicationLog.countDocuments(query);
      return { wouldDelete: count, query };
    }

    const result = await ApplicationLog.deleteMany(query);

    await this.info("Log cleanup completed", {
      category: "system",
      metadata: {
        deletedCount: result.deletedCount,
        olderThan,
        categories,
      },
      source: "DatabaseLogger",
    });

    return result;
  }

  // Force flush all queued logs
  async flush() {
    if (this.logQueue.length > 0) {
      await this.processBatch();
    }
  }

  // Graceful shutdown
  async shutdown() {
    console.log("DatabaseLogger shutting down...");
    await this.flush();
    console.log("DatabaseLogger shutdown complete");
  }
}

// Create singleton instance
const databaseLogger = new DatabaseLogger();

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  await databaseLogger.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await databaseLogger.shutdown();
  process.exit(0);
});

module.exports = databaseLogger;
