const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// JWT Blacklist (In production, use Redis)
const blacklistedTokens = new Set();

// Enhanced JWT utilities
class JWTManager {
  static generateTokens(userId, role = "user") {
    const tokenId = crypto.randomBytes(16).toString("hex");

    const accessToken = jwt.sign(
      {
        userId,
        role,
        tokenId,
        type: "access",
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "15m",
        issuer: "olympia-server",
        audience: "olympia-client",
      }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        tokenId,
        type: "refresh",
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
        issuer: "olympia-server",
        audience: "olympia-client",
      }
    );

    return { accessToken, refreshToken, tokenId };
  }

  static verifyToken(token, secret) {
    try {
      const decoded = jwt.verify(token, secret, {
        issuer: "olympia-server",
        audience: "olympia-client",
      });

      // Check if token is blacklisted
      if (blacklistedTokens.has(decoded.tokenId || token)) {
        throw new Error("Token is blacklisted");
      }

      return decoded;
    } catch (error) {
      throw error;
    }
  }

  static blacklistToken(tokenId) {
    blacklistedTokens.add(tokenId);

    // Clean up old tokens periodically (in production, use Redis with TTL)
    if (blacklistedTokens.size > 10000) {
      const tokensArray = Array.from(blacklistedTokens);
      const halfLength = Math.floor(tokensArray.length / 2);
      blacklistedTokens.clear();
      tokensArray
        .slice(halfLength)
        .forEach((token) => blacklistedTokens.add(token));
    }
  }

  static isTokenBlacklisted(tokenId) {
    return blacklistedTokens.has(tokenId);
  }
}

module.exports = JWTManager;
