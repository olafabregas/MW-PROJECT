const mongoose = require("mongoose");

const securityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "LOGOUT",
        "PASSWORD_CHANGE",
        "PASSWORD_RESET_REQUEST",
        "PASSWORD_RESET_SUCCESS",
        "ACCOUNT_LOCKED",
        "ACCOUNT_UNLOCKED",
        "TWO_FA_ENABLED",
        "TWO_FA_DISABLED",
        "TWO_FA_SUCCESS",
        "TWO_FA_FAILED",
        "PROFILE_CREATED",
        "PROFILE_UPDATED",
        "PROFILE_DELETED",
        "PROFILE_SWITCHED",
        "SUSPICIOUS_ACTIVITY",
        "BRUTE_FORCE_ATTEMPT",
        "UNAUTHORIZED_ACCESS",
        "DATA_BREACH_ATTEMPT",
        "MALICIOUS_INPUT",
        "RATE_LIMIT_EXCEEDED",
        "SESSION_HIJACK_ATTEMPT",
        "PRIVILEGE_ESCALATION",
        "SQL_INJECTION_ATTEMPT",
        "XSS_ATTEMPT",
        "CSRF_ATTEMPT",
        "API_ABUSE",
        "BACKUP_CREATED",
        "BACKUP_RESTORED",
        "SYSTEM_CONFIG_CHANGE",
        "ADMIN_ACTION",
        "SECURITY_SCAN",
      ],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
      index: true,
    },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    },
    statusCode: {
      type: Number,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    additionalData: {
      type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      requestId: String,
      location: {
        country: String,
        region: String,
        city: String,
        timezone: String,
      },
      device: {
        type: String,
        os: String,
        browser: String,
        version: String,
      },
      risk: {
        score: { type: Number, min: 0, max: 100 },
        factors: [String],
        blocked: { type: Boolean, default: false },
      },
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 31536000, // Auto-delete after 1 year for GDPR compliance
    },
  },
  {
    timestamps: true,
    collection: "security_logs",
  }
);

// Compound indexes for efficient querying
securityLogSchema.index({ eventType: 1, createdAt: -1 });
securityLogSchema.index({ userId: 1, eventType: 1, createdAt: -1 });
securityLogSchema.index({ ipAddress: 1, eventType: 1, createdAt: -1 });
securityLogSchema.index({ severity: 1, resolved: 1, createdAt: -1 });
securityLogSchema.index({ "metadata.risk.score": -1, createdAt: -1 });

// Static methods for common security logging operations
securityLogSchema.statics.logEvent = async function (eventData) {
  try {
    const log = new this(eventData);
    await log.save();

    // Alert for critical events
    if (eventData.severity === "CRITICAL") {
      // Implement real-time alerting here
      console.error("CRITICAL SECURITY EVENT:", eventData);
    }

    return log;
  } catch (error) {
    console.error("Failed to log security event:", error);
    throw error;
  }
};

securityLogSchema.statics.getSecuritySummary = async function (timeframe = 24) {
  const startTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);

  const summary = await this.aggregate([
    { $match: { createdAt: { $gte: startTime } } },
    {
      $group: {
        _id: {
          eventType: "$eventType",
          severity: "$severity",
        },
        count: { $sum: 1 },
        latestEvent: { $max: "$createdAt" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return summary;
};

securityLogSchema.statics.getTopThreats = async function (limit = 10) {
  return this.aggregate([
    { $match: { severity: { $in: ["HIGH", "CRITICAL"] } } },
    {
      $group: {
        _id: "$ipAddress",
        threatCount: { $sum: 1 },
        eventTypes: { $addToSet: "$eventType" },
        latestThreat: { $max: "$createdAt" },
        riskScore: { $avg: "$metadata.risk.score" },
      },
    },
    { $sort: { threatCount: -1 } },
    { $limit: limit },
  ]);
};

securityLogSchema.statics.getUserSecurityHistory = async function (
  userId,
  limit = 50
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("resolvedBy", "username email")
    .lean();
};

// Instance methods
securityLogSchema.methods.resolve = async function (resolvedBy, notes) {
  this.resolved = true;
  this.resolvedBy = resolvedBy;
  this.resolvedAt = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

securityLogSchema.methods.updateRiskScore = async function (score, factors) {
  this.metadata.risk.score = score;
  this.metadata.risk.factors = factors;
  return this.save();
};

// Pre-save middleware for additional processing
securityLogSchema.pre("save", function (next) {
  // Auto-calculate risk score if not provided
  if (!this.metadata.risk.score) {
    let score = 0;

    // Base score by severity
    switch (this.severity) {
      case "LOW":
        score = 10;
        break;
      case "MEDIUM":
        score = 30;
        break;
      case "HIGH":
        score = 70;
        break;
      case "CRITICAL":
        score = 90;
        break;
    }

    // Adjust based on event type
    const highRiskEvents = [
      "BRUTE_FORCE_ATTEMPT",
      "UNAUTHORIZED_ACCESS",
      "DATA_BREACH_ATTEMPT",
      "SESSION_HIJACK_ATTEMPT",
      "PRIVILEGE_ESCALATION",
      "SQL_INJECTION_ATTEMPT",
    ];

    if (highRiskEvents.includes(this.eventType)) {
      score = Math.min(100, score + 20);
    }

    this.metadata.risk.score = score;
  }

  next();
});

module.exports = mongoose.model("SecurityLog", securityLogSchema);
