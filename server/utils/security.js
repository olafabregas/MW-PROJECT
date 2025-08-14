const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const SecurityLog = require("../models/SecurityLog");
const logger = require("./logger");

// Enhanced password security configuration
const BCRYPT_CONFIG = {
  SALT_ROUNDS: 14, // High security - computationally expensive
  MIN_PASSWORD_LENGTH: 12,
  MAX_PASSWORD_LENGTH: 128,
  PEPPER: process.env.PASSWORD_PEPPER || crypto.randomBytes(32).toString("hex"),
};

// Advanced password hashing with bcrypt, salt, and pepper
const hashPassword = async (password, additionalSalt = null) => {
  try {
    // Input validation
    if (!password || typeof password !== "string") {
      throw new Error("Password must be a non-empty string");
    }

    if (password.length < BCRYPT_CONFIG.MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${BCRYPT_CONFIG.MIN_PASSWORD_LENGTH} characters long`
      );
    }

    if (password.length > BCRYPT_CONFIG.MAX_PASSWORD_LENGTH) {
      throw new Error(
        `Password must not exceed ${BCRYPT_CONFIG.MAX_PASSWORD_LENGTH} characters`
      );
    }

    // Add pepper to password for additional security layer
    const pepperedPassword = password + BCRYPT_CONFIG.PEPPER;

    // Generate additional salt if provided (for extra security)
    let finalPassword = pepperedPassword;
    if (additionalSalt) {
      finalPassword = pepperedPassword + additionalSalt;
    }

    // Generate salt and hash with bcrypt
    const salt = await bcrypt.genSalt(BCRYPT_CONFIG.SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // Log password creation event
    await SecurityLog.logEvent({
      eventType: "PASSWORD_CHANGE",
      severity: "MEDIUM",
      ipAddress: "internal",
      userAgent: "system",
      additionalData: {
        action: "password_hashed",
        saltRounds: BCRYPT_CONFIG.SALT_ROUNDS,
        hasAdditionalSalt: !!additionalSalt,
      },
      metadata: {
        risk: { score: 10, factors: ["password_creation"] },
      },
    });

    return {
      hashedPassword,
      salt,
      algorithm: "bcrypt",
      rounds: BCRYPT_CONFIG.SALT_ROUNDS,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Password hashing failed:", {
      error: error.message,
      stack: error.stack,
    });

    await SecurityLog.logEvent({
      eventType: "MALICIOUS_INPUT",
      severity: "HIGH",
      ipAddress: "internal",
      userAgent: "system",
      errorMessage: "Password hashing failed",
      additionalData: { error: error.message },
      metadata: {
        risk: { score: 60, factors: ["hash_failure"] },
      },
    });

    throw new Error("Password processing failed");
  }
};

// Enhanced password verification with timing attack protection
const verifyPassword = async (
  plainPassword,
  hashedPassword,
  userId = null,
  ipAddress = "unknown",
  userAgent = "unknown"
) => {
  try {
    // Input validation
    if (!plainPassword || !hashedPassword) {
      throw new Error("Password and hash are required");
    }

    if (
      typeof plainPassword !== "string" ||
      typeof hashedPassword !== "string"
    ) {
      throw new Error("Password and hash must be strings");
    }

    // Add pepper to plain password
    const pepperedPassword = plainPassword + BCRYPT_CONFIG.PEPPER;

    // Perform verification with timing attack protection
    const startTime = process.hrtime.bigint();

    // Always perform a bcrypt operation to prevent timing attacks
    const isValid = await bcrypt.compare(pepperedPassword, hashedPassword);

    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log verification attempt
    const logData = {
      userId,
      eventType: isValid ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
      severity: isValid ? "LOW" : "MEDIUM",
      ipAddress,
      userAgent,
      additionalData: {
        action: "password_verification",
        executionTimeMs: executionTime,
        success: isValid,
      },
      metadata: {
        risk: {
          score: isValid ? 5 : 40,
          factors: isValid ? ["successful_login"] : ["failed_login"],
        },
      },
    };

    await SecurityLog.logEvent(logData);

    // Additional security check for suspicious timing
    if (executionTime < 50) {
      // Suspiciously fast response
      await SecurityLog.logEvent({
        userId,
        eventType: "SUSPICIOUS_ACTIVITY",
        severity: "HIGH",
        ipAddress,
        userAgent,
        additionalData: {
          suspiciousReason: "unusually_fast_password_verification",
          executionTimeMs: executionTime,
        },
        metadata: {
          risk: { score: 75, factors: ["timing_anomaly"] },
        },
      });
    }

    return {
      isValid,
      executionTime,
      verified: isValid,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Password verification failed:", {
      error: error.message,
      userId,
      ipAddress,
    });

    await SecurityLog.logEvent({
      userId,
      eventType: "MALICIOUS_INPUT",
      severity: "HIGH",
      ipAddress,
      userAgent,
      errorMessage: "Password verification failed",
      additionalData: { error: error.message },
      metadata: {
        risk: { score: 70, factors: ["verification_failure"] },
      },
    });

    throw new Error("Password verification failed");
  }
};

// Generate cryptographically secure salt
const generateSecureSalt = (length = 32) => {
  try {
    return crypto.randomBytes(length).toString("hex");
  } catch (error) {
    logger.error("Salt generation failed:", error);
    throw new Error("Failed to generate secure salt");
  }
};

// Password strength checker with enhanced security logging
const checkPasswordStrength = async (
  password,
  userId = null,
  ipAddress = "unknown"
) => {
  try {
    // Enhanced security checks
    const checks = {
      length: password.length >= BCRYPT_CONFIG.MIN_PASSWORD_LENGTH,
      maxLength: password.length <= BCRYPT_CONFIG.MAX_PASSWORD_LENGTH,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noSequence: !/(.)\1{2,}/.test(password), // No 3+ repeated characters
      noCommon: !isCommonPassword(password),
      noUserInfo: !containsUserInfo(password, userId),
      noKeyboardPatterns: !hasKeyboardPatterns(password),
      entropy: calculatePasswordEntropy(password) >= 60, // Minimum entropy requirement
    };

    const score = Object.values(checks).filter(Boolean).length;
    const maxScore = Object.keys(checks).length;
    const percentage = Math.round((score / maxScore) * 100);

    let strength = "very-weak";
    if (percentage >= 90) strength = "very-strong";
    else if (percentage >= 75) strength = "strong";
    else if (percentage >= 60) strength = "medium";
    else if (percentage >= 40) strength = "weak";

    const result = {
      score,
      maxScore,
      percentage,
      strength,
      checks,
      feedback: getPasswordFeedback(checks),
      entropy: calculatePasswordEntropy(password),
      estimatedCrackTime: estimateCrackTime(password),
    };

    // Log password strength check
    await SecurityLog.logEvent({
      userId,
      eventType: "PASSWORD_CHANGE",
      severity:
        strength === "very-weak" || strength === "weak" ? "MEDIUM" : "LOW",
      ipAddress,
      userAgent: "password-checker",
      additionalData: {
        action: "password_strength_check",
        strength,
        score: percentage,
        entropy: result.entropy,
      },
      metadata: {
        risk: {
          score: strength === "very-weak" ? 80 : strength === "weak" ? 60 : 20,
          factors:
            strength === "very-weak" || strength === "weak"
              ? ["weak_password"]
              : ["password_check"],
        },
      },
    });

    return result;
  } catch (error) {
    logger.error("Password strength check failed:", error);
    throw new Error("Password validation failed");
  }
};

const isCommonPassword = (password) => {
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
    "dragon",
    "princess",
    "football",
    "baseball",
    "basketball",
    "soccer",
    "master",
    "jordan",
    "harley",
    "ranger",
    "charlie",
    "superman",
    "batman",
    "trustno1",
    "thomas",
    "robert",
    "lauren",
    "samsung",
    "secret",
    "1234567890",
    "google",
    "iloveyou",
    "liverpool",
    "hello",
    "freedom",
    "whatever",
    "michelle",
    "maggie",
    "sunshine",
    "chocolate",
    "password1",
    "password2",
    "password3",
    "passw0rd",
    "p@ssw0rd",
    "p@ssword",
    "passwd",
    "root",
  ];
  return commonPasswords.includes(password.toLowerCase());
};

// Check for user-specific information in password
const containsUserInfo = (password, userId) => {
  if (!userId) return false;
  // This would typically check against user's name, email, etc.
  // For now, just check if password contains "user" or userId
  const lowerPassword = password.toLowerCase();
  return (
    lowerPassword.includes("user") ||
    lowerPassword.includes(userId.toString().slice(-4))
  );
};

// Check for keyboard patterns
const hasKeyboardPatterns = (password) => {
  const patterns = [
    "qwerty",
    "asdf",
    "zxcv",
    "1234",
    "4321",
    "abcd",
    "dcba",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
    "1234567890",
    "!@#$%^&*()",
    "qwer",
    "asdf",
    "zxcv",
    "wasd",
  ];
  const lowerPassword = password.toLowerCase();
  return patterns.some((pattern) => lowerPassword.includes(pattern));
};

// Calculate password entropy
const calculatePasswordEntropy = (password) => {
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/\d/.test(password)) charsetSize += 10;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 32;

  return Math.log2(Math.pow(charsetSize, password.length));
};

// Estimate crack time
const estimateCrackTime = (password) => {
  const entropy = calculatePasswordEntropy(password);
  const guessesPerSecond = 1000000000; // 1 billion guesses per second (modern hardware)
  const secondsToCrack = Math.pow(2, entropy - 1) / guessesPerSecond;

  if (secondsToCrack < 60) return "Less than a minute";
  if (secondsToCrack < 3600)
    return `${Math.round(secondsToCrack / 60)} minutes`;
  if (secondsToCrack < 86400)
    return `${Math.round(secondsToCrack / 3600)} hours`;
  if (secondsToCrack < 31536000)
    return `${Math.round(secondsToCrack / 86400)} days`;
  if (secondsToCrack < 31536000000)
    return `${Math.round(secondsToCrack / 31536000)} years`;
  return "Centuries";
};

const getPasswordFeedback = (checks) => {
  const feedback = [];
  if (!checks.length)
    feedback.push(
      `Password should be at least ${BCRYPT_CONFIG.MIN_PASSWORD_LENGTH} characters long`
    );
  if (!checks.maxLength)
    feedback.push(
      `Password must not exceed ${BCRYPT_CONFIG.MAX_PASSWORD_LENGTH} characters`
    );
  if (!checks.uppercase) feedback.push("Add uppercase letters (A-Z)");
  if (!checks.lowercase) feedback.push("Add lowercase letters (a-z)");
  if (!checks.number) feedback.push("Add numbers (0-9)");
  if (!checks.special)
    feedback.push('Add special characters (!@#$%^&*(),.?":{}|<>)');
  if (!checks.noSequence) feedback.push("Avoid repeated characters (aaa, 111)");
  if (!checks.noCommon) feedback.push("Avoid common passwords");
  if (!checks.noUserInfo) feedback.push("Don't include personal information");
  if (!checks.noKeyboardPatterns)
    feedback.push("Avoid keyboard patterns (qwerty, 1234)");
  if (!checks.entropy)
    feedback.push("Increase password complexity for better security");

  if (feedback.length === 0) {
    feedback.push("Your password meets all security requirements!");
  }

  return feedback;
};

// Enhanced account lockout system with database logging
class AccountLockout {
  static attempts = new Map(); // In production, use Redis
  static MAX_ATTEMPTS = 5;
  static LOCKOUT_DURATION_BASE = 5 * 60 * 1000; // 5 minutes base
  static MAX_LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour max

  static getAttempts(identifier) {
    return (
      this.attempts.get(identifier) || {
        count: 0,
        lockedUntil: null,
        firstAttempt: null,
      }
    );
  }

  static async recordFailedAttempt(
    identifier,
    userId = null,
    ipAddress = "unknown",
    userAgent = "unknown",
    eventType = "LOGIN_FAILED"
  ) {
    try {
      const attempts = this.getAttempts(identifier);
      attempts.count += 1;
      attempts.lastAttempt = new Date();

      if (!attempts.firstAttempt) {
        attempts.firstAttempt = new Date();
      }

      let severity = "MEDIUM";
      let isLocked = false;

      // Progressive lockout duration
      if (attempts.count >= this.MAX_ATTEMPTS) {
        const lockoutMultiplier = Math.min(
          attempts.count - this.MAX_ATTEMPTS + 1,
          12
        );
        const lockDuration = Math.min(
          this.LOCKOUT_DURATION_BASE * lockoutMultiplier,
          this.MAX_LOCKOUT_DURATION
        );

        attempts.lockedUntil = new Date(Date.now() + lockDuration);
        isLocked = true;
        severity = "HIGH";

        // Log account lockout
        await SecurityLog.logEvent({
          userId,
          eventType: "ACCOUNT_LOCKED",
          severity: "HIGH",
          ipAddress,
          userAgent,
          additionalData: {
            identifier,
            attemptCount: attempts.count,
            lockDurationMs: lockDuration,
            lockoutMultiplier,
          },
          metadata: {
            risk: {
              score: 85,
              factors: ["account_locked", "brute_force"],
            },
          },
        });
      }

      // Log failed attempt
      await SecurityLog.logEvent({
        userId,
        eventType: eventType,
        severity,
        ipAddress,
        userAgent,
        additionalData: {
          identifier,
          attemptNumber: attempts.count,
          maxAttempts: this.MAX_ATTEMPTS,
          isLocked,
          timeToLockout: this.MAX_ATTEMPTS - attempts.count,
        },
        metadata: {
          risk: {
            score: Math.min(90, 20 + attempts.count * 15),
            factors:
              attempts.count >= 3
                ? ["multiple_failures", "brute_force_attempt"]
                : ["failed_attempt"],
          },
        },
      });

      this.attempts.set(identifier, attempts);

      // Detect brute force patterns
      if (attempts.count >= 3) {
        await this.detectBruteForce(identifier, attempts, ipAddress, userAgent);
      }

      return attempts;
    } catch (error) {
      logger.error("Failed to record failed attempt:", {
        error: error.message,
        identifier,
        userId,
      });
      throw error;
    }
  }

  static async detectBruteForce(identifier, attempts, ipAddress, userAgent) {
    const timeDiff = attempts.lastAttempt - attempts.firstAttempt;
    const attemptsPerMinute = attempts.count / (timeDiff / 60000);

    if (attemptsPerMinute > 10) {
      // More than 10 attempts per minute
      await SecurityLog.logEvent({
        eventType: "BRUTE_FORCE_ATTEMPT",
        severity: "CRITICAL",
        ipAddress,
        userAgent,
        additionalData: {
          identifier,
          attemptCount: attempts.count,
          attemptsPerMinute: Math.round(attemptsPerMinute),
          timespan: timeDiff,
        },
        metadata: {
          risk: {
            score: 95,
            factors: ["brute_force", "high_frequency_attacks"],
          },
        },
      });
    }
  }

  static async isLocked(identifier) {
    const attempts = this.getAttempts(identifier);
    const now = new Date();

    if (attempts.lockedUntil && attempts.lockedUntil > now) {
      const remainingTime = attempts.lockedUntil - now;

      return {
        locked: true,
        unlockTime: attempts.lockedUntil,
        attemptsLeft: 0,
        remainingTimeMs: remainingTime,
        remainingTimeFormatted: this.formatDuration(remainingTime),
      };
    }

    return {
      locked: false,
      attemptsLeft: Math.max(0, this.MAX_ATTEMPTS - attempts.count),
      unlockTime: null,
      remainingTimeMs: 0,
    };
  }

  static async clearAttempts(
    identifier,
    userId = null,
    ipAddress = "unknown",
    reason = "manual_clear"
  ) {
    const hadAttempts = this.attempts.has(identifier);
    this.attempts.delete(identifier);

    if (hadAttempts) {
      await SecurityLog.logEvent({
        userId,
        eventType: "ACCOUNT_UNLOCKED",
        severity: "LOW",
        ipAddress,
        userAgent: "system",
        additionalData: {
          identifier,
          reason,
          clearedAt: new Date(),
        },
        metadata: {
          risk: { score: 5, factors: ["account_unlocked"] },
        },
      });
    }
  }

  static formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  static async cleanup() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, value] of this.attempts.entries()) {
      if (value.lockedUntil && value.lockedUntil < now) {
        this.attempts.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info("Account lockout cleanup completed", { cleanedCount });
    }
  }
}

// Run cleanup every hour
setInterval(() => AccountLockout.cleanup(), 60 * 60 * 1000);

// Two-Factor Authentication
class TwoFactorAuth {
  static generateSecret(userIdentifier) {
    return speakeasy.generateSecret({
      name: `Olympia (${userIdentifier})`,
      issuer: "Olympia Movie App",
      length: 32,
    });
  }

  static async generateQRCode(secret) {
    try {
      return await QRCode.toDataURL(secret.otpauth_url);
    } catch (error) {
      throw new Error("Failed to generate QR code");
    }
  }

  static verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Allow 2 time steps (60 seconds) of variance
    });
  }

  static generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 8; i++) {
      codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    return codes;
  }
}

// Enhanced session management with security logging
class SessionManager {
  static sessions = new Map(); // In production, use Redis
  static SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  static MAX_SESSIONS_PER_USER = 5;

  static async createSession(userId, deviceInfo = {}, ipAddress = "unknown") {
    try {
      // Check for existing sessions and enforce limits
      const existingSessions = this.getUserSessions(userId);
      if (existingSessions.length >= this.MAX_SESSIONS_PER_USER) {
        // Remove oldest session
        const oldestSession = existingSessions.sort(
          (a, b) => a.lastActivity - b.lastActivity
        )[0];
        await this.destroySession(
          oldestSession.sessionId,
          "session_limit_exceeded"
        );
      }

      const sessionId = crypto.randomBytes(32).toString("hex");
      const session = {
        userId,
        sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: {
          userAgent: deviceInfo.userAgent || "",
          ip: ipAddress,
          platform: deviceInfo.platform || "",
          browser: deviceInfo.browser || "",
          fingerprint: this.generateDeviceFingerprint(deviceInfo),
        },
        isActive: true,
        securityFlags: {
          isSecure: deviceInfo.secure || false,
          hasValidFingerprint: true,
          trustLevel: this.calculateTrustLevel(deviceInfo, ipAddress),
        },
      };

      this.sessions.set(sessionId, session);

      // Log session creation
      await SecurityLog.logEvent({
        userId,
        sessionId,
        eventType: "LOGIN_SUCCESS",
        severity: "LOW",
        ipAddress,
        userAgent: deviceInfo.userAgent || "unknown",
        additionalData: {
          action: "session_created",
          deviceFingerprint: session.deviceInfo.fingerprint,
          trustLevel: session.securityFlags.trustLevel,
          activeSessions: existingSessions.length + 1,
        },
        metadata: {
          device: {
            os: deviceInfo.platform,
            browser: deviceInfo.browser,
          },
          risk: {
            score: session.securityFlags.trustLevel < 50 ? 40 : 10,
            factors:
              session.securityFlags.trustLevel < 50
                ? ["low_trust_device"]
                : ["session_created"],
          },
        },
      });

      return sessionId;
    } catch (error) {
      logger.error("Session creation failed:", {
        error: error.message,
        userId,
        ipAddress,
      });
      throw error;
    }
  }

  static generateDeviceFingerprint(deviceInfo) {
    const fingerprint = `${deviceInfo.userAgent}-${deviceInfo.platform}-${deviceInfo.browser}`;
    return crypto
      .createHash("sha256")
      .update(fingerprint)
      .digest("hex")
      .substring(0, 16);
  }

  static calculateTrustLevel(deviceInfo, ipAddress) {
    let trustLevel = 50; // Base trust level

    // Known user agent patterns
    if (deviceInfo.userAgent && deviceInfo.userAgent.includes("Chrome"))
      trustLevel += 10;
    if (deviceInfo.userAgent && deviceInfo.userAgent.includes("Firefox"))
      trustLevel += 10;

    // Private IP addresses are more trusted
    if (IPSecurity.isPrivateIP(ipAddress)) trustLevel += 20;

    // Suspicious IP check
    if (IPSecurity.isSuspicious(ipAddress)) trustLevel -= 30;

    return Math.max(0, Math.min(100, trustLevel));
  }

  static getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && this.isSessionValid(session)) {
      return session;
    }
    return null;
  }

  static isSessionValid(session) {
    const now = new Date();
    const sessionAge = now - session.lastActivity;
    return session.isActive && sessionAge < this.SESSION_TIMEOUT;
  }

  static async updateActivity(
    sessionId,
    ipAddress = "unknown",
    suspiciousActivity = false
  ) {
    const session = this.sessions.get(sessionId);
    if (session) {
      const previousActivity = session.lastActivity;
      session.lastActivity = new Date();

      // Check for session hijacking indicators
      if (session.deviceInfo.ip !== ipAddress) {
        await SecurityLog.logEvent({
          userId: session.userId,
          sessionId,
          eventType: "SESSION_HIJACK_ATTEMPT",
          severity: "CRITICAL",
          ipAddress,
          userAgent: "unknown",
          additionalData: {
            originalIP: session.deviceInfo.ip,
            newIP: ipAddress,
            timeDiff: new Date() - previousActivity,
          },
          metadata: {
            risk: {
              score: 95,
              factors: ["session_hijack", "ip_change"],
            },
          },
        });

        // Automatically destroy suspicious session
        await this.destroySession(sessionId, "suspicious_ip_change");
        return false;
      }

      if (suspiciousActivity) {
        await SecurityLog.logEvent({
          userId: session.userId,
          sessionId,
          eventType: "SUSPICIOUS_ACTIVITY",
          severity: "HIGH",
          ipAddress,
          userAgent: session.deviceInfo.userAgent,
          additionalData: {
            action: "suspicious_session_activity",
          },
          metadata: {
            risk: {
              score: 70,
              factors: ["suspicious_activity"],
            },
          },
        });
      }

      this.sessions.set(sessionId, session);
      return true;
    }
    return false;
  }

  static async destroySession(sessionId, reason = "manual_logout") {
    const session = this.sessions.get(sessionId);
    if (session) {
      await SecurityLog.logEvent({
        userId: session.userId,
        sessionId,
        eventType: "LOGOUT",
        severity: "LOW",
        ipAddress: session.deviceInfo.ip,
        userAgent: session.deviceInfo.userAgent,
        additionalData: {
          reason,
          sessionDuration: new Date() - session.createdAt,
        },
        metadata: {
          risk: { score: 5, factors: ["session_ended"] },
        },
      });
    }

    return this.sessions.delete(sessionId);
  }

  static getUserSessions(userId) {
    return Array.from(this.sessions.values()).filter(
      (session) =>
        session.userId === userId &&
        session.isActive &&
        this.isSessionValid(session)
    );
  }

  static async destroyAllUserSessions(
    userId,
    exceptSessionId = null,
    reason = "security_precaution"
  ) {
    let destroyedCount = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId && sessionId !== exceptSessionId) {
        await this.destroySession(sessionId, reason);
        destroyedCount++;
      }
    }

    if (destroyedCount > 0) {
      await SecurityLog.logEvent({
        userId,
        eventType: "LOGOUT",
        severity: "MEDIUM",
        ipAddress: "system",
        userAgent: "system",
        additionalData: {
          action: "destroy_all_sessions",
          reason,
          destroyedCount,
          exceptSessionId,
        },
        metadata: {
          risk: { score: 30, factors: ["mass_logout"] },
        },
      });
    }

    return destroyedCount;
  }

  static async cleanup() {
    const maxAge = this.SESSION_TIMEOUT;
    const cutoff = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff || !session.isActive) {
        await this.destroySession(sessionId, "expired");
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info("Session cleanup completed", { cleanedCount });
    }
  }
}

// Run session cleanup every hour
setInterval(() => SessionManager.cleanup(), 60 * 60 * 1000);

// IP-based security
class IPSecurity {
  static suspiciousIPs = new Set(); // In production, use Redis
  static ipAttempts = new Map(); // Track attempts per IP

  static recordAttempt(ip, type = "general") {
    const key = `${ip}:${type}`;
    const attempts = this.ipAttempts.get(key) || {
      count: 0,
      firstAttempt: new Date(),
    };
    attempts.count += 1;
    attempts.lastAttempt = new Date();

    this.ipAttempts.set(key, attempts);

    // Mark IP as suspicious if too many attempts
    if (attempts.count > 50) {
      // Adjust threshold as needed
      this.suspiciousIPs.add(ip);
    }

    return attempts;
  }

  static isSuspicious(ip) {
    return this.suspiciousIPs.has(ip);
  }

  static getAttempts(ip, type = "general") {
    const key = `${ip}:${type}`;
    return this.ipAttempts.get(key) || { count: 0 };
  }

  static clearIP(ip) {
    this.suspiciousIPs.delete(ip);
    // Clear all attempt types for this IP
    for (const key of this.ipAttempts.keys()) {
      if (key.startsWith(`${ip}:`)) {
        this.ipAttempts.delete(key);
      }
    }
  }

  static isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
      /^fd[0-9a-f]{2}:/,
    ];

    return privateRanges.some((range) => range.test(ip));
  }
}

// Content Security Policy
const getCSPDirectives = () => {
  return {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: [
      "'self'",
      "data:",
      "https://image.tmdb.org",
      "https://res.cloudinary.com",
    ],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'", "https://api.themoviedb.org"],
    mediaSrc: ["'self'", "https://video.tmdb.org"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  };
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove server info
  res.removeHeader("X-Powered-By");

  // Set security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  next();
};

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  // Remove null bytes
  input = input.replace(/\0/g, "");

  // Limit length
  if (input.length > 10000) {
    input = input.substring(0, 10000);
  }

  return input.trim();
};

// Encrypt sensitive data
const encrypt = (text, key = process.env.ENCRYPTION_KEY) => {
  if (!key) throw new Error("Encryption key not provided");

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher("aes-256-gcm", key);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
};

const decrypt = (encryptedData, key = process.env.ENCRYPTION_KEY) => {
  if (!key) throw new Error("Encryption key not provided");

  const decipher = crypto.createDecipher("aes-256-gcm", key);
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));

  let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

module.exports = {
  // Password security functions
  hashPassword,
  verifyPassword,
  generateSecureSalt,
  checkPasswordStrength,
  isCommonPassword,
  containsUserInfo,
  hasKeyboardPatterns,
  calculatePasswordEntropy,
  estimateCrackTime,
  getPasswordFeedback,

  // Security classes
  AccountLockout,
  TwoFactorAuth,
  SessionManager,
  IPSecurity,

  // Utility functions
  getCSPDirectives,
  securityHeaders,
  sanitizeInput,
  encrypt,
  decrypt,

  // Configuration
  BCRYPT_CONFIG,
};
