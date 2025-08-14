const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
let { logger, securityLogger } = require("../utils/logger");

// Fallback loggers if missing
if (!logger) {
  logger = { info: console.log, error: console.error };
}
if (!securityLogger) {
  securityLogger = {
    brute: () => {},
    unauthorizedAccess: () => {},
    suspiciousActivity: () => {},
  };
}

const safeLog = (fn, ...args) => {
  try {
    if (fn) fn(...args);
  } catch (err) {
    console.error("Logging failed:", err.message);
  }
};

// Rate limiter
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      safeLog(securityLogger.brute, req.ip, req.originalUrl, "Rate limit exceeded");
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });

// Slow down limiter (express-slow-down v2+)
const createSpeedLimit = (windowMs, delayAfter, delayMs) =>
  slowDown({
    windowMs,
    delayAfter,
    delayMs,
    maxDelayMs: delayMs * 10,
  });

// Rate limiters
const rateLimiters = {
  general: createRateLimit(15 * 60 * 1000, 100, "Too many requests, try again later.", true),
  auth: createRateLimit(15 * 60 * 1000, 5, "Too many authentication attempts."),
  login: createRateLimit(15 * 60 * 1000, 5, "Too many login attempts."),
  passwordReset: createRateLimit(60 * 60 * 1000, 3, "Too many password reset attempts."),
  register: createRateLimit(60 * 60 * 1000, 3, "Too many registration attempts."),
  movies: createRateLimit(15 * 60 * 1000, 200, "Too many movie API requests.", true),
  search: createRateLimit(1 * 60 * 1000, 30, "Too many search requests.", true),
  createReview: createRateLimit(60 * 60 * 1000, 10, "Too many reviews."),
  admin: createRateLimit(15 * 60 * 1000, 50, "Too many admin requests."),
};

// Speed limiters
const speedLimiters = {
  general: createSpeedLimit(15 * 60 * 1000, 50, 100),
  auth: createSpeedLimit(15 * 60 * 1000, 3, 1000),
  search: createSpeedLimit(1 * 60 * 1000, 20, 200),
};

// IP blocking
const ipBlocklist = new Set();
const ipBlocking = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (ipBlocklist.has(ip)) {
    safeLog(securityLogger.unauthorizedAccess, ip, null, "blocked_ip", "access_attempt");
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
};

// Suspicious activity detection
const suspiciousActivityDetector = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent") || "";
  const referer = req.get("Referer") || "";

  const suspiciousPatterns = [
    /curl/i, /wget/i, /scanner/i,
    /bot(?!.*google|.*bing|.*yahoo)/i,
    /crawler/i, /spider/i,
  ];
  if (suspiciousPatterns.some((p) => p.test(userAgent))) {
    safeLog(securityLogger.suspiciousActivity, ip, "suspicious_user_agent", { userAgent, url: req.originalUrl });
  }

  const sqlInjectionPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
  ];
  const queryString = req.url.split("?")[1] || "";
  if (sqlInjectionPatterns.some((p) => p.test(queryString))) {
    safeLog(securityLogger.suspiciousActivity, ip, "sql_injection_attempt", { url: req.originalUrl, query: queryString });
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  next();
};

// Request logger
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    safeLog(logger.info, "API Request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.userId || null,
    });
  });
  next();
};

// Security headers
const securityHeaders = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'"
  );
  next();
};

// Brute force protection
const bruteForceProtection = {
  blockIP: (ip, duration = 15 * 60 * 1000) => {
    ipBlocklist.add(ip);
    setTimeout(() => ipBlocklist.delete(ip), duration);
    safeLog(securityLogger.brute, ip, "temporary_block", `Blocked for ${duration}ms`);
  },
  isBlocked: (ip) => ipBlocklist.has(ip),
  getBlockedIPs: () => Array.from(ipBlocklist),
  unblockIP: (ip) => {
    ipBlocklist.delete(ip);
    safeLog(logger.info, `IP ${ip} manually unblocked`);
  },
};

module.exports = {
  rateLimiters,
  speedLimiters,
  ipBlocking,
  suspiciousActivityDetector,
  requestLogger,
  securityHeaders,
  bruteForceProtection,
};
