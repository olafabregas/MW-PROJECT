const mongoose = require("mongoose");

// Application Log Schema
const applicationLogSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ["error", "warn", "info", "debug", "verbose"],
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "application",
        "security",
        "audit",
        "performance",
        "api",
        "database",
        "authentication",
        "system",
      ],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    sessionId: {
      type: String,
      index: true,
      sparse: true,
    },
    ipAddress: {
      type: String,
      index: true,
    },
    userAgent: {
      type: String,
    },
    requestId: {
      type: String,
      index: true,
      sparse: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    stack: {
      type: String, // For error stack traces
    },
    duration: {
      type: Number, // For performance logs (in milliseconds)
    },
    statusCode: {
      type: Number, // For API logs
    },
    method: {
      type: String, // For API logs
    },
    url: {
      type: String, // For API logs
    },
    query: {
      type: mongoose.Schema.Types.Mixed, // For database operation logs
    },
    dbCollection: {
      type: String, // For database operation logs (renamed from 'collection' to avoid mongoose warning)
    },
    operation: {
      type: String, // For database operation logs
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    tags: [
      {
        type: String,
        index: true,
      },
    ],
    environment: {
      type: String,
      default: process.env.NODE_ENV || "development",
    },
    source: {
      type: String, // Source file/module that generated the log
      index: true,
    },
    correlationId: {
      type: String, // For tracing related events
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    index: { createdAt: 1 }, // TTL index for automatic cleanup
  }
);

// Compound indexes for efficient querying
applicationLogSchema.index({ level: 1, category: 1, createdAt: -1 });
applicationLogSchema.index({ userId: 1, createdAt: -1 });
applicationLogSchema.index({ ipAddress: 1, createdAt: -1 });
applicationLogSchema.index({ severity: 1, createdAt: -1 });
applicationLogSchema.index({ tags: 1, createdAt: -1 });

// TTL index for automatic log cleanup (90 days)
applicationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Static methods for log analytics
applicationLogSchema.statics.getLogStats = async function (options = {}) {
  const {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    endDate = new Date(),
    userId,
    category,
    level,
  } = options;

  const matchStage = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
  if (category) matchStage.category = category;
  if (level) matchStage.level = level;

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          level: "$level",
          category: "$category",
        },
        count: { $sum: 1 },
        avgDuration: { $avg: "$duration" },
      },
    },
    {
      $group: {
        _id: "$_id.date",
        levels: {
          $push: {
            level: "$_id.level",
            category: "$_id.category",
            count: "$count",
            avgDuration: "$avgDuration",
          },
        },
        totalCount: { $sum: "$count" },
      },
    },
    { $sort: { _id: 1 } },
  ];

  return await this.aggregate(pipeline);
};

applicationLogSchema.statics.getErrorPatterns = async function (options = {}) {
  const {
    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    limit = 10,
  } = options;

  return await this.aggregate([
    {
      $match: {
        level: "error",
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$message",
        count: { $sum: 1 },
        lastOccurrence: { $max: "$createdAt" },
        affectedUsers: { $addToSet: "$userId" },
        sources: { $addToSet: "$source" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
};

applicationLogSchema.statics.getPerformanceMetrics = async function (
  options = {}
) {
  const { startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), operation } =
    options;

  const matchStage = {
    category: "performance",
    duration: { $exists: true },
    createdAt: { $gte: startDate },
  };

  if (operation) matchStage.operation = operation;

  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$operation",
        avgDuration: { $avg: "$duration" },
        minDuration: { $min: "$duration" },
        maxDuration: { $max: "$duration" },
        count: { $sum: 1 },
        p95Duration: {
          $percentile: { input: "$duration", p: [0.95], method: "approximate" },
        },
      },
    },
    { $sort: { avgDuration: -1 } },
  ]);
};

applicationLogSchema.statics.getSecurityInsights = async function (
  options = {}
) {
  const { startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), ipAddress } =
    options;

  const matchStage = {
    category: "security",
    createdAt: { $gte: startDate },
  };

  if (ipAddress) matchStage.ipAddress = ipAddress;

  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          ipAddress: "$ipAddress",
          severity: "$severity",
        },
        count: { $sum: 1 },
        events: { $push: "$message" },
        lastActivity: { $max: "$createdAt" },
      },
    },
    {
      $group: {
        _id: "$_id.ipAddress",
        totalEvents: { $sum: "$count" },
        severityBreakdown: {
          $push: {
            severity: "$_id.severity",
            count: "$count",
          },
        },
        lastActivity: { $max: "$lastActivity" },
      },
    },
    { $sort: { totalEvents: -1 } },
  ]);
};

applicationLogSchema.statics.searchLogs = async function (searchOptions = {}) {
  const {
    query,
    level,
    category,
    userId,
    ipAddress,
    startDate,
    endDate,
    limit = 100,
    page = 1,
    sortBy = "createdAt",
    sortOrder = -1,
  } = searchOptions;

  const matchStage = {};

  if (query) {
    matchStage.$or = [
      { message: { $regex: query, $options: "i" } },
      { "metadata.error": { $regex: query, $options: "i" } },
      { source: { $regex: query, $options: "i" } },
    ];
  }

  if (level) matchStage.level = level;
  if (category) matchStage.category = category;
  if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
  if (ipAddress) matchStage.ipAddress = ipAddress;

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };

  const [logs, totalCount] = await Promise.all([
    this.find(matchStage)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("userId", "email username")
      .lean(),
    this.countDocuments(matchStage),
  ]);

  return {
    logs,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
    hasNextPage: page < Math.ceil(totalCount / limit),
    hasPrevPage: page > 1,
  };
};

// Instance methods
applicationLogSchema.methods.addCorrelatedEvent = async function (eventData) {
  if (!this.correlationId) {
    this.correlationId = new mongoose.Types.ObjectId().toString();
    await this.save();
  }

  return await this.constructor.create({
    ...eventData,
    correlationId: this.correlationId,
  });
};

// Pre-save middleware for data validation and enrichment
applicationLogSchema.pre("save", function (next) {
  // Auto-generate correlation ID for related events
  if (!this.correlationId && this.category === "security") {
    this.correlationId = new mongoose.Types.ObjectId().toString();
  }

  // Set severity based on level if not explicitly set
  if (!this.severity) {
    switch (this.level) {
      case "error":
        this.severity = "high";
        break;
      case "warn":
        this.severity = "medium";
        break;
      case "info":
      case "debug":
      case "verbose":
        this.severity = "low";
        break;
    }
  }

  // Add environment-specific tags
  if (!this.tags.includes(this.environment)) {
    this.tags.push(this.environment);
  }

  next();
});

// Static methods for analytics and querying
applicationLogSchema.statics.searchLogs = async function (searchOptions = {}) {
  const {
    query,
    page = 1,
    limit = 50,
    level,
    category,
    severity,
    userId,
    ipAddress,
    startDate,
    endDate,
    sortBy = "createdAt",
    sortOrder = -1,
  } = searchOptions;

  const match = {};

  if (level) match.level = level;
  if (category) match.category = category;
  if (severity) match.severity = severity;
  if (userId) match.userId = new mongoose.Types.ObjectId(userId);
  if (ipAddress) match.ipAddress = ipAddress;

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  if (query) {
    match.$or = [
      { message: { $regex: query, $options: "i" } },
      { "metadata.error": { $regex: query, $options: "i" } },
      { tags: { $in: [new RegExp(query, "i")] } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };

  const [logs, totalCount] = await Promise.all([
    this.find(match)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("userId", "email username")
      .lean(),
    this.countDocuments(match),
  ]);

  return {
    logs,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
};

applicationLogSchema.statics.getLogStats = async function (options = {}) {
  const { startDate, endDate, category, level } = options;

  const match = {};
  if (category) match.category = category;
  if (level) match.level = level;
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          level: "$level",
          category: "$category",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        count: { $sum: 1 },
        avgDuration: { $avg: "$duration" },
      },
    },
    { $sort: { "_id.date": -1 } },
  ]);
};

applicationLogSchema.statics.getErrorPatterns = async function (options = {}) {
  const { startDate } = options;

  const match = { level: "error" };
  if (startDate) match.createdAt = { $gte: new Date(startDate) };

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$message",
        count: { $sum: 1 },
        lastOccurrence: { $max: "$createdAt" },
        sources: { $addToSet: "$source" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
};

applicationLogSchema.statics.getPerformanceMetrics = async function (
  options = {}
) {
  const { startDate } = options;

  const match = {
    category: "performance",
    duration: { $exists: true },
  };
  if (startDate) match.createdAt = { $gte: new Date(startDate) };

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$operation",
        avgDuration: { $avg: "$duration" },
        maxDuration: { $max: "$duration" },
        minDuration: { $min: "$duration" },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgDuration: -1 } },
  ]);
};

applicationLogSchema.statics.getSecurityInsights = async function (
  options = {}
) {
  const { startDate } = options;

  const match = { category: "security" };
  if (startDate) match.createdAt = { $gte: new Date(startDate) };

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          severity: "$severity",
          eventType: "$metadata.eventType",
        },
        count: { $sum: 1 },
        uniqueIPs: { $addToSet: "$ipAddress" },
        latestEvent: { $max: "$createdAt" },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

const ApplicationLog = mongoose.model("ApplicationLog", applicationLogSchema);

module.exports = ApplicationLog;
