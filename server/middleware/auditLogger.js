const { auditLogger } = require("../utils/logger");

// Audit logging middleware for sensitive operations
const auditLog = (action, resource) => {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
      // Log the audit event
      const auditData = {
        userId: req.user ? req.user._id : null,
        username: req.user ? req.user.username : "anonymous",
        action,
        resource,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
        requestBody: req.method !== "GET" ? req.body : undefined,
        success: res.statusCode < 400,
      };

      // Don't log sensitive data
      if (auditData.requestBody && auditData.requestBody.password) {
        auditData.requestBody = {
          ...auditData.requestBody,
          password: "[REDACTED]",
        };
      }

      auditLogger.info("User action audit", auditData);

      return originalSend.call(this, data);
    };

    next();
  };
};

// Specific audit loggers for different actions
const auditLoggers = {
  // Authentication actions
  login: auditLog("LOGIN", "auth"),
  logout: auditLog("LOGOUT", "auth"),
  register: auditLog("REGISTER", "auth"),
  passwordReset: auditLog("PASSWORD_RESET", "auth"),

  // User management actions
  profileUpdate: auditLog("PROFILE_UPDATE", "user"),
  accountDelete: auditLog("ACCOUNT_DELETE", "user"),
  roleChange: auditLog("ROLE_CHANGE", "user"),

  // Content actions
  reviewCreate: auditLog("REVIEW_CREATE", "review"),
  reviewUpdate: auditLog("REVIEW_UPDATE", "review"),
  reviewDelete: auditLog("REVIEW_DELETE", "review"),
  reviewModerate: auditLog("REVIEW_MODERATE", "review"),

  // Watchlist actions
  watchlistAdd: auditLog("WATCHLIST_ADD", "watchlist"),
  watchlistRemove: auditLog("WATCHLIST_REMOVE", "watchlist"),
  watchlistUpdate: auditLog("WATCHLIST_UPDATE", "watchlist"),

  // Feedback actions
  feedbackSubmit: auditLog("FEEDBACK_SUBMIT", "feedback"),
  feedbackRespond: auditLog("FEEDBACK_RESPOND", "feedback"),
  feedbackResolve: auditLog("FEEDBACK_RESOLVE", "feedback"),

  // Admin actions
  adminUserManagement: auditLog("ADMIN_USER_MANAGEMENT", "admin"),
  adminContentModeration: auditLog("ADMIN_CONTENT_MODERATION", "admin"),
  adminSystemConfig: auditLog("ADMIN_SYSTEM_CONFIG", "admin"),
  adminBackup: auditLog("ADMIN_BACKUP", "admin"),
  adminRestore: auditLog("ADMIN_RESTORE", "admin"),

  // System actions
  systemMaintenance: auditLog("SYSTEM_MAINTENANCE", "system"),
  systemBackup: auditLog("SYSTEM_BACKUP", "system"),
  systemRestore: auditLog("SYSTEM_RESTORE", "system"),
};

// Security event logger for suspicious activities
const logSecurityEvent = (eventType, details, req) => {
  const securityData = {
    eventType,
    severity: details.severity || "medium",
    details,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    userId: req.user ? req.user._id : null,
    sessionId: req.session ? req.session.id : null,
  };

  auditLogger.warn("Security event detected", securityData);

  // You could also send alerts or notifications here for critical events
  if (details.severity === "critical") {
    // Send immediate alert to security team
    console.error("CRITICAL SECURITY EVENT:", securityData);
  }
};

// Request logger for debugging and monitoring
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
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

    // Log based on status code
    if (res.statusCode >= 500) {
      auditLogger.error("Server error", logData);
    } else if (res.statusCode >= 400) {
      auditLogger.warn("Client error", logData);
    } else {
      auditLogger.info("Request completed", logData);
    }
  });

  next();
};

// Performance monitoring logger
const performanceLogger = (threshold = 1000) => {
  return (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;

      if (duration > threshold) {
        auditLogger.warn("Slow request detected", {
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          statusCode: res.statusCode,
          ip: req.ip,
          userId: req.user ? req.user._id : null,
          timestamp: new Date().toISOString(),
        });
      }
    });

    next();
  };
};

// Database operation logger
const dbOperationLogger = (operation, collection, details = {}) => {
  auditLogger.info("Database operation", {
    operation,
    collection,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Error logger
const errorLogger = (error, req, additionalContext = {}) => {
  const errorData = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user ? req.user._id : null,
    },
    context: additionalContext,
    timestamp: new Date().toISOString(),
  };

  auditLogger.error("Application error", errorData);
};

module.exports = {
  auditLog,
  auditLoggers,
  logSecurityEvent,
  requestLogger,
  performanceLogger,
  dbOperationLogger,
  errorLogger,
};
