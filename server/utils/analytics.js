const mongoose = require("mongoose");

// API Analytics Schema
const apiAnalyticsSchema = new mongoose.Schema(
  {
    endpoint: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
      enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    },
    statusCode: {
      type: Number,
      required: true,
      index: true,
    },
    responseTime: {
      type: Number,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    error: {
      message: String,
      stack: String,
      code: String,
    },
    requestSize: Number,
    responseSize: Number,
  },
  {
    collection: "api_analytics",
  }
);

// Indexes for analytics queries
apiAnalyticsSchema.index({ endpoint: 1, timestamp: -1 });
apiAnalyticsSchema.index({ method: 1, timestamp: -1 });
apiAnalyticsSchema.index({ statusCode: 1, timestamp: -1 });
apiAnalyticsSchema.index({ userId: 1, timestamp: -1 });
apiAnalyticsSchema.index({ timestamp: -1 });

// TTL index to automatically delete old analytics data (30 days)
apiAnalyticsSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

const ApiAnalytics = mongoose.model("ApiAnalytics", apiAnalyticsSchema);

// Analytics middleware
const analyticsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  let responseSize = 0;

  // Override res.send to capture response size
  res.send = function (data) {
    responseSize = Buffer.byteLength(data || "", "utf8");
    return originalSend.call(this, data);
  };

  res.on("finish", async () => {
    try {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Skip analytics for certain endpoints to avoid noise
      const skipEndpoints = ["/api/health", "/favicon.ico", "/robots.txt"];
      if (skipEndpoints.some((endpoint) => req.path.includes(endpoint))) {
        return;
      }

      const analyticsData = {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        userId: req.userId || null,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        requestSize: req.get("Content-Length") || 0,
        responseSize,
        timestamp: new Date(startTime),
      };

      // Add error information if response was not successful
      if (res.statusCode >= 400 && res.locals.error) {
        analyticsData.error = {
          message: res.locals.error.message,
          code: res.locals.error.code,
        };
      }

      // Save analytics data asynchronously
      await ApiAnalytics.create(analyticsData);
    } catch (error) {
      console.error("Analytics logging error:", error);
    }
  });

  next();
};

// Analytics service
class AnalyticsService {
  // Get endpoint performance metrics
  static async getEndpointMetrics(timeframe = "24h") {
    const timeFrameMap = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - timeFrameMap[timeframe]);

    return await ApiAnalytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$endpoint",
          totalRequests: { $sum: 1 },
          averageResponseTime: { $avg: "$responseTime" },
          maxResponseTime: { $max: "$responseTime" },
          minResponseTime: { $min: "$responseTime" },
          errorCount: {
            $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
          },
          errorRate: {
            $avg: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
          },
        },
      },
      { $sort: { totalRequests: -1 } },
      { $limit: 20 },
    ]);
  }

  // Get traffic patterns
  static async getTrafficPatterns(timeframe = "24h") {
    const timeFrameMap = {
      "24h": { $hour: "$timestamp" },
      "7d": { $dayOfWeek: "$timestamp" },
      "30d": { $dayOfMonth: "$timestamp" },
    };

    const since = new Date(
      Date.now() -
        (timeframe === "24h"
          ? 24 * 60 * 60 * 1000
          : timeframe === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000)
    );

    return await ApiAnalytics.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: timeFrameMap[timeframe],
          requestCount: { $sum: 1 },
          averageResponseTime: { $avg: "$responseTime" },
          errorCount: {
            $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  // Get user activity metrics
  static async getUserActivityMetrics(timeframe = "24h") {
    const timeFrameMap = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - timeFrameMap[timeframe]);

    return await ApiAnalytics.aggregate([
      {
        $match: {
          timestamp: { $gte: since },
          userId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$userId",
          requestCount: { $sum: 1 },
          lastActivity: { $max: "$timestamp" },
          endpoints: { $addToSet: "$endpoint" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          username: "$user.username",
          requestCount: 1,
          lastActivity: 1,
          endpointCount: { $size: "$endpoints" },
        },
      },
      { $sort: { requestCount: -1 } },
      { $limit: 50 },
    ]);
  }

  // Get error analytics
  static async getErrorAnalytics(timeframe = "24h") {
    const timeFrameMap = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - timeFrameMap[timeframe]);

    return await ApiAnalytics.aggregate([
      {
        $match: {
          timestamp: { $gte: since },
          statusCode: { $gte: 400 },
        },
      },
      {
        $group: {
          _id: {
            endpoint: "$endpoint",
            statusCode: "$statusCode",
            errorCode: "$error.code",
          },
          count: { $sum: 1 },
          lastOccurrence: { $max: "$timestamp" },
          examples: { $push: "$error.message" },
        },
      },
      {
        $project: {
          endpoint: "$_id.endpoint",
          statusCode: "$_id.statusCode",
          errorCode: "$_id.errorCode",
          count: 1,
          lastOccurrence: 1,
          exampleMessage: { $arrayElemAt: ["$examples", 0] },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);
  }

  // Get performance insights
  static async getPerformanceInsights() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const slowEndpoints = await ApiAnalytics.aggregate([
      { $match: { timestamp: { $gte: since24h } } },
      {
        $group: {
          _id: "$endpoint",
          averageResponseTime: { $avg: "$responseTime" },
          requestCount: { $sum: 1 },
        },
      },
      { $match: { averageResponseTime: { $gte: 1000 } } }, // Slower than 1 second
      { $sort: { averageResponseTime: -1 } },
      { $limit: 10 },
    ]);

    const errorRates = await ApiAnalytics.aggregate([
      { $match: { timestamp: { $gte: since24h } } },
      {
        $group: {
          _id: "$endpoint",
          totalRequests: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          endpoint: "$_id",
          totalRequests: 1,
          errorCount: 1,
          errorRate: { $divide: ["$errorCount", "$totalRequests"] },
        },
      },
      { $match: { errorRate: { $gte: 0.05 } } }, // Error rate >= 5%
      { $sort: { errorRate: -1 } },
      { $limit: 10 },
    ]);

    return {
      slowEndpoints,
      errorRates,
    };
  }

  // Get real-time metrics
  static async getRealTimeMetrics() {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const last1Hour = new Date(Date.now() - 60 * 60 * 1000);

    const [currentActivity, hourlyComparison] = await Promise.all([
      ApiAnalytics.aggregate([
        { $match: { timestamp: { $gte: last5Minutes } } },
        {
          $group: {
            _id: null,
            requestCount: { $sum: 1 },
            averageResponseTime: { $avg: "$responseTime" },
            errorCount: {
              $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
            },
          },
        },
      ]),

      ApiAnalytics.aggregate([
        { $match: { timestamp: { $gte: last1Hour } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d %H:%M",
                date: {
                  $dateTrunc: {
                    date: "$timestamp",
                    unit: "minute",
                    binSize: 5,
                  },
                },
              },
            },
            requestCount: { $sum: 1 },
            averageResponseTime: { $avg: "$responseTime" },
            errorCount: {
              $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      current: currentActivity[0] || {
        requestCount: 0,
        averageResponseTime: 0,
        errorCount: 0,
      },
      trend: hourlyComparison,
    };
  }

  // Clean old analytics data (manually, as backup to TTL)
  static async cleanOldData(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await ApiAnalytics.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    return {
      deletedCount: result.deletedCount,
      cutoffDate,
    };
  }
}

module.exports = {
  ApiAnalytics,
  analyticsMiddleware,
  AnalyticsService,
};
