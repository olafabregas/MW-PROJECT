const {
  hashPassword,
  verifyPassword,
  AccountLockout,
  SessionManager,
  IPSecurity,
  checkPasswordStrength,
} = require("../utils/security");
const SecurityLog = require("../models/SecurityLog");
const logger = require("../utils/logger");

// Enhanced authentication middleware with comprehensive security logging
const enhancedAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (!token) {
      await SecurityLog.logEvent({
        eventType: "UNAUTHORIZED_ACCESS",
        severity: "MEDIUM",
        ipAddress,
        userAgent,
        endpoint: req.path,
        method: req.method,
        additionalData: {
          reason: "missing_token",
          endpoint: req.path,
        },
        metadata: {
          risk: { score: 50, factors: ["no_auth_token"] },
        },
      });

      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    // Verify session exists and is valid
    const sessionId = req.headers["x-session-id"];
    if (sessionId) {
      const session = SessionManager.getSession(sessionId);
      if (!session) {
        await SecurityLog.logEvent({
          eventType: "SESSION_HIJACK_ATTEMPT",
          severity: "HIGH",
          ipAddress,
          userAgent,
          endpoint: req.path,
          method: req.method,
          additionalData: {
            reason: "invalid_session",
            sessionId,
          },
          metadata: {
            risk: { score: 80, factors: ["invalid_session"] },
          },
        });

        return res.status(401).json({ error: "Invalid session" });
      }

      // Update session activity
      await SessionManager.updateActivity(sessionId, ipAddress);
      req.sessionId = sessionId;
    }

    // Check for suspicious IP
    if (IPSecurity.isSuspicious(ipAddress)) {
      await SecurityLog.logEvent({
        eventType: "SUSPICIOUS_ACTIVITY",
        severity: "HIGH",
        ipAddress,
        userAgent,
        endpoint: req.path,
        method: req.method,
        additionalData: {
          reason: "suspicious_ip",
          action: "blocked_request",
        },
        metadata: {
          risk: { score: 85, factors: ["suspicious_ip"] },
        },
      });

      return res
        .status(403)
        .json({ error: "Access denied from this IP address" });
    }

    // Record API access
    IPSecurity.recordAttempt(ipAddress, "api_access");

    next();
  } catch (error) {
    logger.error("Authentication middleware error:", {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      path: req.path,
    });

    await SecurityLog.logEvent({
      eventType: "MALICIOUS_INPUT",
      severity: "HIGH",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      endpoint: req.path,
      method: req.method,
      errorMessage: error.message,
      additionalData: {
        error: error.message,
        action: "auth_middleware_error",
      },
      metadata: {
        risk: { score: 70, factors: ["auth_error"] },
      },
    });

    res.status(500).json({ error: "Authentication error" });
  }
};

// Password security middleware for registration/password changes
const passwordSecurityMiddleware = async (req, res, next) => {
  try {
    const { password } = req.body;
    const ipAddress = req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (!password) {
      return next();
    }

    // Check password strength
    const strengthCheck = await checkPasswordStrength(
      password,
      req.user?.userId,
      ipAddress
    );

    if (
      strengthCheck.strength === "very-weak" ||
      strengthCheck.strength === "weak"
    ) {
      await SecurityLog.logEvent({
        userId: req.user?.userId,
        eventType: "MALICIOUS_INPUT",
        severity: "MEDIUM",
        ipAddress,
        userAgent,
        endpoint: req.path,
        method: req.method,
        additionalData: {
          reason: "weak_password",
          strength: strengthCheck.strength,
          score: strengthCheck.percentage,
        },
        metadata: {
          risk: { score: 60, factors: ["weak_password"] },
        },
      });

      return res.status(400).json({
        error: "Password does not meet security requirements",
        strengthCheck: {
          strength: strengthCheck.strength,
          feedback: strengthCheck.feedback,
          score: strengthCheck.percentage,
        },
      });
    }

    // Hash the password and store strength info
    const hashedData = await hashPassword(password);
    req.body.hashedPassword = hashedData.hashedPassword;
    req.body.passwordStrength = strengthCheck;

    // Remove plain password from request
    delete req.body.password;

    next();
  } catch (error) {
    logger.error("Password security middleware error:", error);

    await SecurityLog.logEvent({
      userId: req.user?.userId,
      eventType: "MALICIOUS_INPUT",
      severity: "HIGH",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      endpoint: req.path,
      method: req.method,
      errorMessage: error.message,
      additionalData: {
        error: error.message,
        action: "password_middleware_error",
      },
      metadata: {
        risk: { score: 70, factors: ["password_error"] },
      },
    });

    res.status(500).json({ error: "Password processing error" });
  }
};

// Login security middleware with lockout protection
const loginSecurityMiddleware = async (req, res, next) => {
  try {
    const { email, username } = req.body;
    const identifier = email || username;
    const ipAddress = req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (!identifier) {
      return res.status(400).json({ error: "Email or username is required" });
    }

    // Check account lockout
    const lockStatus = await AccountLockout.isLocked(identifier);
    if (lockStatus.locked) {
      await SecurityLog.logEvent({
        eventType: "ACCOUNT_LOCKED",
        severity: "HIGH",
        ipAddress,
        userAgent,
        endpoint: req.path,
        method: req.method,
        additionalData: {
          identifier,
          unlockTime: lockStatus.unlockTime,
          remainingTime: lockStatus.remainingTimeFormatted,
        },
        metadata: {
          risk: { score: 75, factors: ["locked_account_access"] },
        },
      });

      return res.status(423).json({
        error:
          "Account is temporarily locked due to multiple failed login attempts",
        unlockTime: lockStatus.unlockTime,
        remainingTime: lockStatus.remainingTimeFormatted,
      });
    }

    // Check IP-based lockout
    const ipAttempts = IPSecurity.getAttempts(ipAddress, "login");
    if (ipAttempts.count > 20) {
      // IP-based protection
      await SecurityLog.logEvent({
        eventType: "BRUTE_FORCE_ATTEMPT",
        severity: "CRITICAL",
        ipAddress,
        userAgent,
        endpoint: req.path,
        method: req.method,
        additionalData: {
          reason: "ip_based_lockout",
          attemptCount: ipAttempts.count,
        },
        metadata: {
          risk: { score: 90, factors: ["ip_brute_force"] },
        },
      });

      return res.status(429).json({
        error:
          "Too many login attempts from this IP address. Please try again later.",
      });
    }

    req.loginIdentifier = identifier;
    next();
  } catch (error) {
    logger.error("Login security middleware error:", error);
    res.status(500).json({ error: "Login security check failed" });
  }
};

// Security headers middleware
const securityHeadersMiddleware = (req, res, next) => {
  // Remove server information
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  // Set comprehensive security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://image.tmdb.org https://res.cloudinary.com",
    "connect-src 'self' https://api.themoviedb.org",
    "media-src 'self' https://video.tmdb.org",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);

  // HSTS in production
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  next();
};

// Request sanitization middleware
const sanitizeRequestMiddleware = (req, res, next) => {
  try {
    // Sanitize query parameters
    for (const key in req.query) {
      if (typeof req.query[key] === "string") {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    }

    // Sanitize body parameters
    if (req.body && typeof req.body === "object") {
      sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    logger.error("Request sanitization error:", error);
    res.status(400).json({ error: "Invalid request data" });
  }
};

// Helper function to sanitize objects recursively
const sanitizeObject = (obj) => {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      obj[key] = sanitizeInput(obj[key]);
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
};

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  // Remove null bytes and control characters
  input = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remove potential XSS patterns
  input = input.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
  input = input.replace(/javascript:/gi, "");
  input = input.replace(/on\w+\s*=/gi, "");

  // Remove SQL injection patterns
  input = input.replace(
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b)/gi,
    ""
  );

  // Limit length
  if (input.length > 10000) {
    input = input.substring(0, 10000);
  }

  return input.trim();
};

// Rate limiting middleware for sensitive operations
const sensitiveOperationRateLimit = (
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
) => {
  const attempts = new Map();

  return async (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const userAttempts = attempts.get(key) || {
      count: 0,
      resetTime: now + windowMs,
    };

    if (now > userAttempts.resetTime) {
      userAttempts.count = 0;
      userAttempts.resetTime = now + windowMs;
    }

    if (userAttempts.count >= maxAttempts) {
      await SecurityLog.logEvent({
        eventType: "RATE_LIMIT_EXCEEDED",
        severity: "HIGH",
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        endpoint: req.path,
        method: req.method,
        additionalData: {
          attemptCount: userAttempts.count,
          maxAttempts,
          windowMs,
        },
        metadata: {
          risk: { score: 70, factors: ["rate_limit_exceeded"] },
        },
      });

      return res.status(429).json({
        error: "Rate limit exceeded for this operation",
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000),
      });
    }

    userAttempts.count++;
    attempts.set(key, userAttempts);
    next();
  };
};

module.exports = {
  enhancedAuth,
  passwordSecurityMiddleware,
  loginSecurityMiddleware,
  securityHeadersMiddleware,
  sanitizeRequestMiddleware,
  sensitiveOperationRateLimit,
  sanitizeInput,
};
