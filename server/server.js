// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const http = require("http");
const socketIo = require("socket.io");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const movieRoutes = require("./routes/movies");
const userRoutes = require("./routes/users");
const reviewRoutes = require("./routes/reviews");
const adminRoutes = require("./routes/admin");
const systemRoutes = require("./routes/system");
const notificationRoutes = require("./routes/notifications");
const feedbackRoutes = require("./routes/feedback");
const watchlistRoutes = require("./routes/watchlist");
const logsRoutes = require("./routes/logs");
const profilesRoutes = require("./routes/profiles");
const securityDashboardRoutes = require("./routes/securityDashboard");

// Import middleware
const securityMiddleware = require("./middleware/security");
const errorHandler = require("./middleware/errorHandler");
const {
  auditLoggers,
  requestLogger,
  performanceLogger,
} = require("./middleware/auditLogger");

// Import utilities
const { logger } = require("./utils/logger");
const { logManager } = require("./utils/logManager");
const databaseLogger = require("./utils/databaseLogger");

// Import services
const analyticsService = require("./services/analyticsService");
const NotificationService = require("./services/notificationService");
const backupService = require("./services/backupService");
const healthService = require("./services/healthService");

const app = express();
const server = http.createServer(app); // FIX: This is the server we'll start
const PORT = process.env.PORT || 5000; // FIX: Define before using

// Socket.IO setup for real-time features
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Initialize notification service with Socket.IO
const notificationService = new NotificationService(io);

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Request logging and performance monitoring
app.use(requestLogger);
app.use(performanceLogger(2000));

// Database logging middleware
app.use(async (req, res, next) => {
  const startTime = Date.now();
  req.requestId = require("crypto").randomBytes(16).toString("hex");

  await databaseLogger.logAPI(
    "REQUEST_START",
    {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
      requestId: req.requestId,
    },
    req
  );

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    databaseLogger
      .logAPI(
        "REQUEST_COMPLETE",
        {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          requestId: req.requestId,
        },
        req
      )
      .catch((err) => console.error("Failed to log API completion:", err));

    originalEnd.apply(this, args);
  };

  next();
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Security middleware
app.use(securityMiddleware); // ERROR WHEN RUNNING

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/olympia")
  .then(async () => {
    logger.info("✅ Connected to MongoDB");
    await databaseLogger.logSystem("DATABASE_CONNECTED", {
      database: "olympia",
      connectionString:
        process.env.MONGODB_URI || "mongodb://localhost:27017/olympia",
    });
  })
  .catch(async (error) => {
    logger.error("❌ MongoDB connection error:", error);
    await databaseLogger.logError("Failed to connect to MongoDB", error);
  });

// Routes
app.use("/api/auth", auditLoggers.login, authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/profiles", profilesRoutes);
app.use("/api/security", securityDashboardRoutes);

app.use("/uploads", express.static("uploads"));

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const systemHealth = await healthService.getSystemHealth();
    res.status(systemHealth.status === "healthy" ? 200 : 503).json({
      status: systemHealth.status,
      message: "Olympia Server Health Check",
      timestamp: new Date().toISOString(),
      details: systemHealth,
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Error handling
app.use(errorHandler); // ERROR WHEN RUNNING

// 404 handler
app.use("", (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Route not found",
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString(),
  });
});

// Log manager init
logManager.init().catch((error) => {
  logger.error("Failed to initialize log manager:", error);
});

// Start HTTP + Socket.IO server
server.listen(PORT, async () => {
  const message = `🚀 Olympia Server running on port ${PORT}`;
  logger.info(message);
  console.log(message);

  await databaseLogger.logSystem("SERVER_STARTED", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    startupTime: new Date().toISOString(),
  });
});

// Robust global error handlers
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  console.error("Uncaught Exception:", err);
  // Do not exit immediately, allow for debugging
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", reason);
  console.error("Unhandled Rejection:", reason);
  // Do not exit immediately, allow for debugging
});

// Graceful shutdown
["SIGTERM", "SIGINT"].forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} received, shutting down gracefully`);
    await databaseLogger.logSystem("SERVER_SHUTDOWN", {
      reason: signal,
      timestamp: new Date().toISOString(),
    });
    server.close(() => {
      mongoose.connection.close();
      process.exit(0);
    });
  });
});

// Keep-alive log to confirm process is running
setInterval(() => {
  logger.info("Server keep-alive: process is still running");
}, 60000); // every 60 seconds

module.exports = { app, io, notificationService };
