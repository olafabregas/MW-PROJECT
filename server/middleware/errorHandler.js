// Safe logger import with fallback
let logger;
try {
  const loggerModule = require("../utils/logger");
  logger = loggerModule.logger || console;
} catch (e) {
  console.warn("⚠ Logger module not found, using console as fallback");
  logger = console;
}

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message || "Unexpected error");
    this.statusCode = statusCode || 500;
    this.status = `${this.statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message || "Validation failed", 400);
    this.errors = Array.isArray(errors) ? errors : [];
  }
}
class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401);
  }
}
class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403);
  }
}
class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}
class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409);
  }
}
class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded", retryAfter = null) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}
class DatabaseError extends AppError {
  constructor(message = "Database operation failed") {
    super(message, 500, false);
  }
}
class ExternalAPIError extends AppError {
  constructor(message = "External API error", service = "unknown") {
    super(message, 502, false);
    this.service = service;
  }
}

// Safe error response formatter
const formatErrorResponse = (error, req) => {
  try {
    const response = {
      success: false,
      message: error?.message || "An unexpected error occurred",
      timestamp: new Date().toISOString(),
      path: req?.originalUrl || null,
      method: req?.method || null,
    };

    if (req?.requestId) response.requestId = req.requestId;
    if (error?.errors && Array.isArray(error.errors)) response.errors = error.errors;
    if (error?.retryAfter) response.retryAfter = error.retryAfter;
    if (process.env.NODE_ENV === "development" && error?.stack) response.stack = error.stack;

    return response;
  } catch (formatErr) {
    logger.error("Error while formatting error response", formatErr);
    return { success: false, message: "Error processing error response" };
  }
};

// Specific error transformers
const handleCastError = (err) => new ValidationError(`Invalid ${err.path}: ${err.value}`);
const handleDuplicateFieldsError = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue ? err.keyValue[field] : "unknown";
  return new ConflictError(`${field} '${value}' already exists`);
};
const handleValidationError = (err) => {
  const errors = Object.values(err.errors || {}).map((el) => ({
    field: el?.path,
    message: el?.message,
    value: el?.value,
  }));
  return new ValidationError("Validation failed", errors);
};
const handleJWTError = () => new AuthenticationError("Invalid token");
const handleJWTExpiredError = () => new AuthenticationError("Token expired");
const handleMongoNetworkError = () => new DatabaseError("Database connection failed");
const handleMongoTimeoutError = () => new DatabaseError("Database operation timed out");

// Send error responses
const sendErrorDev = (err, req, res) => {
  try {
    const response = formatErrorResponse(err, req);
    logger.error("Development Error", {
      error: err?.message,
      stack: err?.stack,
      url: req?.originalUrl,
      method: req?.method,
      ip: req?.ip,
      userAgent: req?.get ? req.get("User-Agent") : undefined,
      userId: req?.userId,
    });
    res?.status(err?.statusCode || 500).json(response);
  } catch (e) {
    console.error("Error while sending dev error response", e);
    res?.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const sendErrorProd = (err, req, res) => {
  try {
    if (err?.isOperational) {
      const response = formatErrorResponse(err, req);
      delete response.stack;
      logger.error("Operational Error", {
        error: err?.message,
        statusCode: err?.statusCode,
        url: req?.originalUrl,
        method: req?.method,
        ip: req?.ip,
        userId: req?.userId,
      });
      res?.status(err?.statusCode || 500).json(response);
    } else {
      logger.error("System Error", {
        error: err?.message,
        stack: err?.stack,
        url: req?.originalUrl,
        method: req?.method,
        ip: req?.ip,
        userId: req?.userId,
      });
      res?.status(500).json({
        success: false,
        message: "Something went wrong!",
        timestamp: new Date().toISOString(),
        path: req?.originalUrl || null,
        method: req?.method || null,
        requestId: req?.requestId || null,
      });
    }
  } catch (e) {
    console.error("Error while sending prod error response", e);
    res?.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Main error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  try {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";
    let error = { ...err, message: err.message };

    if (err.name === "CastError") error = handleCastError(error);
    if (err.code === 11000) error = handleDuplicateFieldsError(error);
    if (err.name === "ValidationError") error = handleValidationError(error);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
    if (err.name === "MongoNetworkError") error = handleMongoNetworkError();
    if (err.name === "MongoTimeoutError") error = handleMongoTimeoutError();

    if (process.env.NODE_ENV === "development") sendErrorDev(error, req, res);
    else sendErrorProd(error, req, res);
  } catch (handlerErr) {
    console.error("Error inside globalErrorHandler", handlerErr);
    res?.status(500).json({ success: false, message: "Critical error in error handler" });
  }
};

// Async wrapper
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Cannot find ${req?.originalUrl || "requested resource"} on this server`));
};

// Process event handlers
const handleUnhandledRejection = () => {
  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled Promise Rejection", { error: err?.message, stack: err?.stack });
    if (process.env.NODE_ENV === "production") process.exit(1);
    else logger.warn("Dev mode: keeping server alive after unhandledRejection");
  });
};

const handleUncaughtException = () => {
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception", { error: err?.message, stack: err?.stack });
    if (process.env.NODE_ENV === "production") process.exit(1);
    else logger.warn("Dev mode: keeping server alive after uncaughtException");
  });
};

const handleGracefulShutdown = (server) => {
  ["SIGTERM", "SIGINT", "SIGUSR2"].forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      server.close(() => {
        logger.info("Server closed");
        if (process.env.NODE_ENV === "production") process.exit(0);
      });
      setTimeout(() => {
        logger.error("Force shutdown after timeout");
        if (process.env.NODE_ENV === "production") process.exit(1);
      }, 10000);
    });
  });
};

// Error monitor
const monitorErrors = () => {
  const patterns = new Map();
  const trackError = (error, context = {}) => {
    const key = `${error?.name}:${error?.message}`;
    const existing = patterns.get(key) || { count: 0, firstSeen: new Date(), lastSeen: new Date() };
    existing.count++;
    existing.lastSeen = new Date();
    patterns.set(key, existing);
    if (existing.count > 10) {
      logger.warn("Frequent Error Pattern", { pattern: key, count: existing.count, context });
    }
  };
  return { trackError, getErrorPatterns: () => patterns };
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalAPIError,
  globalErrorHandler,
  catchAsync,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  handleGracefulShutdown,
  formatErrorResponse,
  monitorErrors,
};
