const os = require("os");
const mongoose = require("mongoose");
const cron = require("node-cron");
const { logger } = require("../utils/logger");
const { CacheManager, apiCache } = require("../utils/cache");

class HealthService {
  constructor() {
    this.healthChecks = new Map();
    this.alertThresholds = {
      cpu: 80, // %
      memory: 85, // %
      disk: 90, // %
      responseTime: 5000, // ms
      errorRate: 5, // %
      dbConnections: 100,
    };
    this.healthHistory = [];
    this.maxHistorySize = 1440; // 24 hours of minute-by-minute data
    this.init();
  }

  async init() {
    try {
      // Register default health checks
      this.registerDefaultHealthChecks();

      // Start monitoring
      this.startHealthMonitoring();

      logger.info("Health monitoring service initialized");
    } catch (error) {
      logger.error("Failed to initialize health service:", error);
    }
  }

  // Register a custom health check
  registerHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      check: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      interval: options.interval || 60000, // 1 minute
      lastCheck: null,
      status: "unknown",
      error: null,
    });

    logger.info(`Health check registered: ${name}`);
  }

  // Remove a health check
  unregisterHealthCheck(name) {
    if (this.healthChecks.delete(name)) {
      logger.info(`Health check removed: ${name}`);
      return true;
    }
    return false;
  }

  // Get current system health
  async getSystemHealth() {
    try {
      const [
        systemMetrics,
        databaseHealth,
        cacheHealth,
        applicationHealth,
        externalServices,
      ] = await Promise.all([
        this.getSystemMetrics(),
        this.getDatabaseHealth(),
        this.getCacheHealth(),
        this.getApplicationHealth(),
        this.checkExternalServices(),
      ]);

      const overallStatus = this.calculateOverallStatus([
        systemMetrics.status,
        databaseHealth.status,
        cacheHealth.status,
        applicationHealth.status,
        externalServices.status,
      ]);

      const health = {
        status: overallStatus,
        timestamp: new Date(),
        system: systemMetrics,
        database: databaseHealth,
        cache: cacheHealth,
        application: applicationHealth,
        external: externalServices,
        alerts: await this.getActiveAlerts(),
      };

      // Store in history
      this.addToHistory(health);

      return health;
    } catch (error) {
      logger.error("Failed to get system health:", error);
      return {
        status: "error",
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  // Get system metrics
  async getSystemMetrics() {
    try {
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();
      const loadAverage = os.loadavg();
      const uptime = os.uptime();

      const metrics = {
        cpu: {
          usage: cpuUsage,
          cores: os.cpus().length,
          loadAverage: loadAverage[0], // 1 minute average
        },
        memory: {
          total: memoryUsage.total,
          used: memoryUsage.used,
          free: memoryUsage.free,
          usage: memoryUsage.percentage,
        },
        disk: diskUsage,
        uptime: uptime,
        platform: os.platform(),
        architecture: os.arch(),
        nodeVersion: process.version,
      };

      // Determine status based on thresholds
      const status = this.evaluateSystemStatus(metrics);

      return {
        status,
        metrics,
        checks: {
          cpu: cpuUsage < this.alertThresholds.cpu,
          memory: memoryUsage.percentage < this.alertThresholds.memory,
          disk: diskUsage.usage < this.alertThresholds.disk,
        },
      };
    } catch (error) {
      logger.error("Failed to get system metrics:", error);
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  // Get database health
  async getDatabaseHealth() {
    try {
      const start = Date.now();

      // Check MongoDB connection
      const dbState = mongoose.connection.readyState;
      const stateNames = [
        "disconnected",
        "connected",
        "connecting",
        "disconnecting",
      ];
      const connectionStatus = stateNames[dbState] || "unknown";

      if (dbState !== 1) {
        return {
          status: "unhealthy",
          connection: connectionStatus,
          error: "Database not connected",
        };
      }

      // Test database operation
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - start;

      // Get database stats
      const dbStats = await mongoose.connection.db.stats();
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();

      // Get connection pool stats
      const adminDb = mongoose.connection.db.admin();
      const serverStatus = await adminDb.serverStatus();

      const health = {
        status:
          responseTime < this.alertThresholds.responseTime
            ? "healthy"
            : "degraded",
        connection: connectionStatus,
        responseTime,
        stats: {
          collections: collections.length,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          objects: dbStats.objects,
        },
        connections: {
          current: serverStatus.connections.current,
          available: serverStatus.connections.available,
          totalCreated: serverStatus.connections.totalCreated,
        },
        version: serverStatus.version,
        uptime: serverStatus.uptime,
      };

      return health;
    } catch (error) {
      logger.error("Database health check failed:", error);
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  // Get cache health
  async getCacheHealth() {
    try {
      const start = Date.now();

      // Test cache operation
      const testKey = "health_check_test";
      const testValue = "test_value";

      // Use CacheManager to set, get, and delete from apiCache
      CacheManager.set(apiCache, testKey, testValue, 5);
      const retrieved = CacheManager.get(apiCache, testKey);
      CacheManager.del(apiCache, testKey);

      const responseTime = Date.now() - start;

      if (retrieved !== testValue) {
        throw new Error("Cache read/write test failed");
      }

      // Get cache info (NodeCache specific)
      let cacheInfo = {
        keys: apiCache.keys().length,
        stats: apiCache.getStats(),
      };

      return {
        status: responseTime < 100 ? "healthy" : "degraded",
        responseTime,
        info: cacheInfo,
      };
    } catch (error) {
      logger.error("Cache health check failed:", error);
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  // Get application health
  async getApplicationHealth() {
    try {
      const processMetrics = {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        versions: process.versions,
      };

      // Check custom health checks
      const customChecks = {};
      for (const [name, check] of this.healthChecks.entries()) {
        try {
          const result = await Promise.race([
            check.check(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), check.timeout)
            ),
          ]);

          customChecks[name] = {
            status: "healthy",
            result,
            lastCheck: new Date(),
          };

          check.status = "healthy";
          check.error = null;
        } catch (error) {
          customChecks[name] = {
            status: "unhealthy",
            error: error.message,
            lastCheck: new Date(),
          };

          check.status = "unhealthy";
          check.error = error.message;
        }

        check.lastCheck = new Date();
      }

      const allHealthy = Object.values(customChecks).every(
        (check) => check.status === "healthy"
      );

      return {
        status: allHealthy ? "healthy" : "degraded",
        process: processMetrics,
        customChecks,
      };
    } catch (error) {
      logger.error("Application health check failed:", error);
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  // Check external services
  async checkExternalServices() {
    try {
      const services = {
        tmdb: await this.checkTMDbAPI(),
        // Add other external services here
      };

      const allHealthy = Object.values(services).every(
        (service) => service.status === "healthy"
      );

      return {
        status: allHealthy ? "healthy" : "degraded",
        services,
      };
    } catch (error) {
      logger.error("External services health check failed:", error);
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  // Check TMDb API
  async checkTMDbAPI() {
    try {
      const start = Date.now();
      const response = await fetch(
        `https://api.themoviedb.org/3/configuration?api_key=${process.env.TMDB_API_KEY}`
      );
      const responseTime = Date.now() - start;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        status: "healthy",
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        lastCheck: new Date(),
      };
    }
  }

  // Helper methods
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        const timeDiff = endTime - startTime;

        const totalUsage = (endUsage.user + endUsage.system) / 1000; // Convert to milliseconds
        const percentage = (totalUsage / timeDiff) * 100;

        resolve(Math.round(percentage * 100) / 100);
      }, 100);
    });
  }

  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  async getDiskUsage() {
    // This is a simplified version - in production, you'd want to check actual disk usage
    try {
      const stats = await new Promise((resolve, reject) => {
        require("fs").stat(".", (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });

      // Placeholder values - implement actual disk usage checking
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB placeholder
        used: 50 * 1024 * 1024 * 1024, // 50GB placeholder
        free: 50 * 1024 * 1024 * 1024, // 50GB placeholder
        usage: 50, // 50% placeholder
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0,
        error: error.message,
      };
    }
  }

  evaluateSystemStatus(metrics) {
    const issues = [];

    if (metrics.cpu.usage > this.alertThresholds.cpu) {
      issues.push("High CPU usage");
    }

    if (metrics.memory.usage > this.alertThresholds.memory) {
      issues.push("High memory usage");
    }

    if (metrics.disk.usage > this.alertThresholds.disk) {
      issues.push("High disk usage");
    }

    if (issues.length === 0) return "healthy";
    if (issues.length <= 2) return "degraded";
    return "unhealthy";
  }

  calculateOverallStatus(statuses) {
    if (statuses.includes("unhealthy")) return "unhealthy";
    if (statuses.includes("degraded")) return "degraded";
    if (statuses.includes("error")) return "error";
    return "healthy";
  }

  parseRedisInfo(info) {
    const lines = info.split("\r\n");
    const parsed = {};

    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":");
        parsed[key] = isNaN(value) ? value : Number(value);
      }
    }

    return parsed;
  }

  addToHistory(health) {
    this.healthHistory.push({
      timestamp: health.timestamp,
      status: health.status,
      cpu: health.system?.metrics?.cpu?.usage || 0,
      memory: health.system?.metrics?.memory?.usage || 0,
      responseTime: health.database?.responseTime || 0,
    });

    // Keep only recent history
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  async getActiveAlerts() {
    const alerts = [];
    const health = await this.getSystemHealth();

    // Check system alerts
    if (health.system?.metrics?.cpu?.usage > this.alertThresholds.cpu) {
      alerts.push({
        type: "system",
        severity: "warning",
        message: `High CPU usage: ${health.system.metrics.cpu.usage}%`,
        timestamp: new Date(),
      });
    }

    if (health.system?.metrics?.memory?.usage > this.alertThresholds.memory) {
      alerts.push({
        type: "system",
        severity: "warning",
        message: `High memory usage: ${health.system.metrics.memory.usage}%`,
        timestamp: new Date(),
      });
    }

    // Check database alerts
    if (health.database?.responseTime > this.alertThresholds.responseTime) {
      alerts.push({
        type: "database",
        severity: "warning",
        message: `Slow database response: ${health.database.responseTime}ms`,
        timestamp: new Date(),
      });
    }

    // Check custom health checks
    if (health.application?.customChecks) {
      for (const [name, check] of Object.entries(
        health.application.customChecks
      )) {
        if (check.status === "unhealthy") {
          alerts.push({
            type: "application",
            severity: "error",
            message: `Health check failed: ${name} - ${check.error}`,
            timestamp: new Date(),
          });
        }
      }
    }

    return alerts;
  }

  // Get health history
  getHealthHistory(period = "1h") {
    const now = new Date();
    let since;

    switch (period) {
      case "1h":
        since = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "6h":
        since = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(now.getTime() - 60 * 60 * 1000);
    }

    return this.healthHistory.filter((h) => h.timestamp >= since);
  }

  // Register default health checks
  registerDefaultHealthChecks() {
    // Database connectivity check
    this.registerHealthCheck(
      "database_connection",
      async () => {
        if (mongoose.connection.readyState !== 1) {
          throw new Error("Database not connected");
        }
        await mongoose.connection.db.admin().ping();
        return "Connected";
      },
      { critical: true }
    );

    // Cache connectivity check
    this.registerHealthCheck(
      "cache_connection",
      async () => {
        CacheManager.set(apiCache, "health_check", "ok", 5);
        const result = CacheManager.get(apiCache, "health_check");
        if (result !== "ok") {
          throw new Error("Cache read/write failed");
        }
        CacheManager.del(apiCache, "health_check");
        return "Connected";
      },
      { critical: false }
    );

    // Memory usage check
    this.registerHealthCheck(
      "memory_usage",
      async () => {
        const usage = this.getMemoryUsage();
        if (usage.percentage > 90) {
          throw new Error(`Critical memory usage: ${usage.percentage}%`);
        }
        return `Memory usage: ${usage.percentage}%`;
      },
      { critical: true }
    );
  }

  // Start health monitoring
  startHealthMonitoring() {
    // Continuous health monitoring every minute
    cron.schedule("* * * * *", async () => {
      try {
        const health = await this.getSystemHealth();

        // Cache the health status
        CacheManager.set(
          apiCache,
          "system_health",
          JSON.stringify(health),
          120
        );

        // Log critical issues
        if (health.status === "unhealthy") {
          logger.error("System health is unhealthy:", health);
        } else if (health.status === "degraded") {
          logger.warn("System health is degraded:", health);
        }
      } catch (error) {
        logger.error("Health monitoring failed:", error);
      }
    });

    // Detailed health report every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        const health = await this.getSystemHealth();
        const alerts = await this.getActiveAlerts();

        if (alerts.length > 0) {
          logger.warn(`Active alerts: ${alerts.length}`, alerts);
        }
      } catch (error) {
        logger.error("Detailed health monitoring failed:", error);
      }
    });
  }
}

module.exports = new HealthService();
