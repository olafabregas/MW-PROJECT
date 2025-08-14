const winston = require("winston");
const path = require("path");

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log formats
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (stack) {
      log += `\nStack: ${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

// Create different loggers for different purposes
const createLogger = (filename, level = "info") => {
  return winston.createLogger({
    level,
    format: logFormat,
    transports: [
      // File transport
      new winston.transports.File({
        filename: path.join(logsDir, filename),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
      }),

      // Console transport (only in development)
      ...(process.env.NODE_ENV !== "production"
        ? [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              ),
            }),
          ]
        : []),
    ],

    // Handle exceptions and rejections
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(logsDir, "exceptions.log"),
      }),
    ],

    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(logsDir, "rejections.log"),
      }),
    ],
  });
};

// Different loggers for different purposes
const logger = createLogger("app.log");
const errorLogger = createLogger("error.log", "error");
const securityLogger = createLogger("security.log");
const performanceLogger = createLogger("performance.log");
const auditLogger = createLogger("audit.log");

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code = null, isOperational = true) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND_ERROR");
  }
}

class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded") {
    super(message, 429, "RATE_LIMIT_ERROR");
  }
}

class ExternalServiceError extends AppError {
  constructor(message = "External service error", service = "unknown") {
    super(message, 502, "EXTERNAL_SERVICE_ERROR");
    this.service = service;
  }
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log the error
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.userId || "anonymous",
    timestamp: new Date().toISOString(),
  };

  // Log based on error type and severity
  if (err.statusCode >= 500) {
    errorLogger.error("Server Error", errorInfo);
  } else if (err.statusCode >= 400) {
    logger.warn("Client Error", errorInfo);
  } else {
    logger.info("General Error", errorInfo);
  }

  // Security-related errors
  if (
    err.code === "AUTHENTICATION_ERROR" ||
    err.code === "AUTHORIZATION_ERROR"
  ) {
    securityLogger.warn("Security Event", {
      type: err.code,
      message: err.message,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.url,
      userId: req.userId || "anonymous",
    });
  }

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  // Handle specific error types
  if (err.name === "ValidationError" && err.errors) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors,
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    code: err.code || "INTERNAL_ERROR",
    ...(isDevelopment && {
      stack: err.stack,
      details: err,
    }),
  });
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Request logging middleware
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
      userId: req.userId || "anonymous",
    };

    if (duration > 1000) {
      performanceLogger.warn("Slow Request", logData);
    } else {
      logger.info("Request", logData);
    }
  });

  next();
};

// Security event logger
const logSecurityEvent = (event, req, additional = {}) => {
  securityLogger.warn("Security Event", {
    event,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    url: req.originalUrl,
    method: req.method,
    userId: req.userId || "anonymous",
    timestamp: new Date().toISOString(),
    ...additional,
  });
};

// Audit logger
const logAuditEvent = (action, req, target = null, additional = {}) => {
  auditLogger.info("Audit Event", {
    action,
    actor: req.userId || "anonymous",
    target,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
    ...additional,
  });
};

module.exports = {
  logger,
  errorLogger,
  securityLogger,
  performanceLogger,
  auditLogger,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  requestLogger,
  logSecurityEvent,
  logAuditEvent,
};
