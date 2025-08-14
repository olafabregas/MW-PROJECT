const rateLimit = require("express-rate-limit");

// Advanced rate limiting configurations
const createRateLimiter = (
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false
) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.round(windowMs / 1000),
      });
    },
  });
};

// Different rate limits for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  "Too many authentication attempts, please try again later"
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  "Too many API requests, please try again later"
);

const strictLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 requests
  "Rate limit exceeded, please slow down"
);

const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 uploads
  "Too many upload attempts, please try again later"
);

module.exports = {
  authLimiter,
  apiLimiter,
  strictLimiter,
  uploadLimiter,
};
