const express = require("express");
const SecurityLog = require("../models/SecurityLog");
const {
  AccountLockout,
  SessionManager,
  IPSecurity,
} = require("../utils/security");
const { auth } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Get security dashboard overview
router.get("/dashboard", [auth, adminOnly], async (req, res) => {
  try {
    const timeframe = parseInt(req.query.timeframe) || 24; // hours
    const startTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);

    // Get security summary
    const [
      recentEvents,
      criticalEvents,
      topThreats,
      eventSummary,
      lockedAccounts,
      activeSessions,
    ] = await Promise.all([
      SecurityLog.find({ createdAt: { $gte: startTime } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      SecurityLog.find({
        severity: { $in: ["HIGH", "CRITICAL"] },
        createdAt: { $gte: startTime },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      SecurityLog.getTopThreats(10),
      SecurityLog.getSecuritySummary(timeframe),
      getLockedAccountsInfo(),
      getActiveSessionsInfo(),
    ]);

    // Calculate metrics
    const metrics = {
      totalEvents: recentEvents.length,
      criticalEvents: criticalEvents.length,
      threatScore: calculateOverallThreatScore(recentEvents),
      systemHealth: calculateSystemHealth(recentEvents, criticalEvents),
      trends: calculateSecurityTrends(recentEvents),
    };

    // Group events by severity
    const eventsBySeverity = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {});

    // Get hourly event distribution
    const hourlyDistribution = getHourlyEventDistribution(recentEvents);

    res.json({
      metrics,
      recentEvents: recentEvents.slice(0, 20), // Latest 20 events
      criticalEvents: criticalEvents.slice(0, 10), // Latest 10 critical events
      topThreats,
      eventSummary,
      eventsBySeverity,
      hourlyDistribution,
      lockedAccounts,
      activeSessions,
      timeframe,
      lastUpdated: new Date(),
    });
  } catch (error) {
    logger.error("Security dashboard error:", error);
    res.status(500).json({ error: "Failed to load security dashboard" });
  }
});

// Get detailed security analytics
router.get("/analytics", [auth, adminOnly], async (req, res) => {
  try {
    const { startDate, endDate, eventType, severity, ipAddress, userId } =
      req.query;

    // Build query
    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (ipAddress) query.ipAddress = ipAddress;
    if (userId) query.userId = userId;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      SecurityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "username email")
        .populate("resolvedBy", "username email")
        .lean(),

      SecurityLog.countDocuments(query),
    ]);

    // Get aggregated data
    const [eventTypeStats, severityStats, ipStats, timelineData] =
      await Promise.all([
        SecurityLog.aggregate([
          { $match: query },
          { $group: { _id: "$eventType", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),

        SecurityLog.aggregate([
          { $match: query },
          { $group: { _id: "$severity", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),

        SecurityLog.aggregate([
          { $match: query },
          { $group: { _id: "$ipAddress", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]),

        SecurityLog.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" },
              },
              count: { $sum: 1 },
              criticalCount: {
                $sum: { $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    res.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      analytics: {
        eventTypeStats,
        severityStats,
        ipStats,
        timelineData,
      },
    });
  } catch (error) {
    logger.error("Security analytics error:", error);
    res.status(500).json({ error: "Failed to load security analytics" });
  }
});

// Get real-time security status
router.get("/status", [auth, adminOnly], async (req, res) => {
  try {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const last1Hour = new Date(Date.now() - 60 * 60 * 1000);

    const [
      recentCriticalEvents,
      recentFailedLogins,
      recentBruteForceAttempts,
      activeThreats,
    ] = await Promise.all([
      SecurityLog.countDocuments({
        severity: "CRITICAL",
        createdAt: { $gte: last5Minutes },
      }),

      SecurityLog.countDocuments({
        eventType: "LOGIN_FAILED",
        createdAt: { $gte: last1Hour },
      }),

      SecurityLog.countDocuments({
        eventType: "BRUTE_FORCE_ATTEMPT",
        createdAt: { $gte: last1Hour },
      }),

      SecurityLog.find({
        severity: { $in: ["HIGH", "CRITICAL"] },
        resolved: false,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).lean(),
    ]);

    // System status
    const systemStatus = {
      level: "GREEN", // GREEN, YELLOW, RED
      threats: activeThreats.length,
      alerts: recentCriticalEvents,
    };

    // Determine threat level
    if (recentCriticalEvents > 5 || activeThreats.length > 10) {
      systemStatus.level = "RED";
    } else if (
      recentCriticalEvents > 2 ||
      activeThreats.length > 5 ||
      recentBruteForceAttempts > 10
    ) {
      systemStatus.level = "YELLOW";
    }

    // Get current lockout status
    const lockoutStatus = {
      totalLocked: AccountLockout.attempts.size,
      recentLockouts: Array.from(AccountLockout.attempts.entries()).filter(
        ([_, attempt]) =>
          attempt.lockedUntil && attempt.lockedUntil > new Date()
      ).length,
    };

    // Get session status
    const sessionStatus = {
      totalActive: SessionManager.sessions.size,
      recentLogins: Array.from(SessionManager.sessions.values()).filter(
        (session) => new Date() - session.createdAt < 60 * 60 * 1000
      ).length, // Last hour
    };

    res.json({
      systemStatus,
      lockoutStatus,
      sessionStatus,
      recentMetrics: {
        criticalEvents: recentCriticalEvents,
        failedLogins: recentFailedLogins,
        bruteForceAttempts: recentBruteForceAttempts,
      },
      activeThreats: activeThreats.slice(0, 10), // Top 10 active threats
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error("Security status error:", error);
    res.status(500).json({ error: "Failed to get security status" });
  }
});

// Resolve security incident
router.post(
  "/incidents/:incidentId/resolve",
  [auth, adminOnly],
  async (req, res) => {
    try {
      const { incidentId } = req.params;
      const { notes } = req.body;

      const incident = await SecurityLog.findById(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Security incident not found" });
      }

      if (incident.resolved) {
        return res.status(400).json({ error: "Incident already resolved" });
      }

      await incident.resolve(req.user.userId, notes);

      // Log the resolution
      await SecurityLog.logEvent({
        userId: req.user.userId,
        eventType: "ADMIN_ACTION",
        severity: "LOW",
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        additionalData: {
          action: "incident_resolved",
          incidentId: incident._id,
          originalEventType: incident.eventType,
          notes,
        },
        metadata: {
          risk: { score: 5, factors: ["incident_resolution"] },
        },
      });

      logger.info("Security incident resolved", {
        incidentId,
        resolvedBy: req.user.userId,
        eventType: incident.eventType,
      });

      res.json({
        message: "Security incident resolved successfully",
        incident: {
          _id: incident._id,
          eventType: incident.eventType,
          resolved: incident.resolved,
          resolvedAt: incident.resolvedAt,
          resolvedBy: incident.resolvedBy,
          notes: incident.notes,
        },
      });
    } catch (error) {
      logger.error("Incident resolution error:", error);
      res.status(500).json({ error: "Failed to resolve security incident" });
    }
  }
);

// Block IP address
router.post("/block-ip", [auth, adminOnly], async (req, res) => {
  try {
    const { ipAddress, reason } = req.body;

    if (!ipAddress) {
      return res.status(400).json({ error: "IP address is required" });
    }

    // Add IP to suspicious list
    IPSecurity.suspiciousIPs.add(ipAddress);

    // Log the action
    await SecurityLog.logEvent({
      userId: req.user.userId,
      eventType: "ADMIN_ACTION",
      severity: "MEDIUM",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      additionalData: {
        action: "ip_blocked",
        blockedIP: ipAddress,
        reason: reason || "manual_block",
      },
      metadata: {
        risk: { score: 30, factors: ["ip_blocked"] },
      },
    });

    logger.info("IP address blocked", {
      blockedIP: ipAddress,
      blockedBy: req.user.userId,
      reason,
    });

    res.json({
      message: "IP address blocked successfully",
      ipAddress,
      reason,
    });
  } catch (error) {
    logger.error("IP blocking error:", error);
    res.status(500).json({ error: "Failed to block IP address" });
  }
});

// Unblock IP address
router.post("/unblock-ip", [auth, adminOnly], async (req, res) => {
  try {
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({ error: "IP address is required" });
    }

    // Remove IP from suspicious list and clear attempts
    IPSecurity.clearIP(ipAddress);

    // Log the action
    await SecurityLog.logEvent({
      userId: req.user.userId,
      eventType: "ADMIN_ACTION",
      severity: "LOW",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      additionalData: {
        action: "ip_unblocked",
        unblockedIP: ipAddress,
      },
      metadata: {
        risk: { score: 5, factors: ["ip_unblocked"] },
      },
    });

    logger.info("IP address unblocked", {
      unblockedIP: ipAddress,
      unblockedBy: req.user.userId,
    });

    res.json({
      message: "IP address unblocked successfully",
      ipAddress,
    });
  } catch (error) {
    logger.error("IP unblocking error:", error);
    res.status(500).json({ error: "Failed to unblock IP address" });
  }
});

// Unlock user account
router.post("/unlock-account", [auth, adminOnly], async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: "Account identifier is required" });
    }

    // Clear account lockout
    await AccountLockout.clearAttempts(
      identifier,
      req.user.userId,
      req.ip,
      "admin_unlock"
    );

    logger.info("Account unlocked by admin", {
      identifier,
      unlockedBy: req.user.userId,
    });

    res.json({
      message: "Account unlocked successfully",
      identifier,
    });
  } catch (error) {
    logger.error("Account unlock error:", error);
    res.status(500).json({ error: "Failed to unlock account" });
  }
});

// Helper functions
const calculateOverallThreatScore = (events) => {
  if (events.length === 0) return 0;

  const severityWeights = {
    LOW: 1,
    MEDIUM: 3,
    HIGH: 7,
    CRITICAL: 10,
  };

  const totalScore = events.reduce((sum, event) => {
    return sum + (severityWeights[event.severity] || 0);
  }, 0);

  return Math.min(100, Math.round((totalScore / events.length) * 10));
};

const calculateSystemHealth = (recentEvents, criticalEvents) => {
  const criticalRatio =
    criticalEvents.length / Math.max(recentEvents.length, 1);

  if (criticalRatio > 0.1) return "CRITICAL";
  if (criticalRatio > 0.05 || criticalEvents.length > 5) return "DEGRADED";
  if (recentEvents.length > 100) return "ELEVATED";
  return "HEALTHY";
};

const calculateSecurityTrends = (events) => {
  const now = new Date();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);

  const recentEvents = events.filter((e) => e.createdAt >= oneHourAgo);
  const olderEvents = events.filter((e) => e.createdAt < oneHourAgo);

  return {
    recent: recentEvents.length,
    previous: olderEvents.length,
    trend:
      recentEvents.length > olderEvents.length
        ? "INCREASING"
        : recentEvents.length < olderEvents.length
        ? "DECREASING"
        : "STABLE",
  };
};

const getHourlyEventDistribution = (events) => {
  const distribution = {};
  const now = new Date();

  // Initialize last 24 hours
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 60 * 60 * 1000);
    const key = hour.toISOString().slice(0, 13) + ":00";
    distribution[key] = 0;
  }

  // Count events per hour
  events.forEach((event) => {
    const hour = event.createdAt.toISOString().slice(0, 13) + ":00";
    if (distribution.hasOwnProperty(hour)) {
      distribution[hour]++;
    }
  });

  return Object.entries(distribution).map(([time, count]) => ({ time, count }));
};

const getLockedAccountsInfo = () => {
  const lockedAccounts = Array.from(AccountLockout.attempts.entries())
    .filter(
      ([_, attempt]) => attempt.lockedUntil && attempt.lockedUntil > new Date()
    )
    .map(([identifier, attempt]) => ({
      identifier,
      lockedUntil: attempt.lockedUntil,
      attemptCount: attempt.count,
    }));

  return {
    total: lockedAccounts.length,
    accounts: lockedAccounts.slice(0, 10), // Top 10
  };
};

const getActiveSessionsInfo = () => {
  const sessions = Array.from(SessionManager.sessions.values()).filter(
    (session) => session.isActive && SessionManager.isSessionValid(session)
  );

  const sessionsByUser = {};
  sessions.forEach((session) => {
    sessionsByUser[session.userId] = (sessionsByUser[session.userId] || 0) + 1;
  });

  return {
    total: sessions.length,
    uniqueUsers: Object.keys(sessionsByUser).length,
    avgSessionsPerUser:
      sessions.length / Math.max(Object.keys(sessionsByUser).length, 1),
  };
};

module.exports = router;
