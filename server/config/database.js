const mongoose = require("mongoose");

// Database connection with optimized settings
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection settings
      maxPoolSize: 10, // Maximum number of connections
      serverSelectionTimeoutMS: 5000, // How long to try selecting a server
      socketTimeoutMS: 45000, // How long a send or receive on a socket can take
      family: 4, // Use IPv4, skip trying IPv6

      // Buffering settings
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering

      // Compression
      compressors: ["zlib"],
      zlibCompressionLevel: 6,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("connected", () => {
      console.log("📡 Mongoose connected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ Mongoose connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("📡 Mongoose disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("📡 Mongoose connection closed through app termination");
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
};

// Index creation utilities
const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;

    // User collection indexes
    await db
      .collection("users")
      .createIndexes([
        { key: { email: 1 }, unique: true },
        { key: { username: 1 }, unique: true },
        { key: { "watchlist.movieId": 1 } },
        { key: { "favorites.movieId": 1 } },
        { key: { "watchedMovies.movieId": 1 } },
        { key: { role: 1 } },
        { key: { createdAt: -1 } },
        { key: { "stats.totalMoviesWatched": -1 } },
        { key: { "stats.totalReviews": -1 } },
      ]);

    // Review collection indexes
    await db.collection("reviews").createIndexes([
      { key: { movieId: 1, createdAt: -1 } },
      { key: { user: 1, createdAt: -1 } },
      { key: { rating: 1 } },
      { key: { isApproved: 1 } },
      { key: { "likes.user": 1 } },
      { key: { createdAt: -1 } },
      { key: { movieId: 1, user: 1 }, unique: true }, // Prevent duplicate reviews
      { key: { "flags.0": 1, isApproved: 1 } }, // For flagged content
      { key: { helpfulCount: -1 } }, // For sorting by helpfulness

      // Compound indexes for common queries
      { key: { movieId: 1, isApproved: 1, createdAt: -1 } },
      { key: { user: 1, isApproved: 1, createdAt: -1 } },
      { key: { isApproved: 1, rating: -1, createdAt: -1 } },
    ]);

    // Text indexes for search
    await db.collection("reviews").createIndex(
      {
        title: "text",
        content: "text",
        movieTitle: "text",
      },
      {
        weights: {
          title: 10,
          movieTitle: 5,
          content: 1,
        },
        name: "review_text_index",
      }
    );

    await db.collection("users").createIndex(
      {
        username: "text",
        email: "text",
      },
      {
        weights: {
          username: 10,
          email: 5,
        },
        name: "user_text_index",
      }
    );

    console.log("✅ Database indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();

    const stats = await mongoose.connection.db.stats();

    return {
      status: "healthy",
      ping: result,
      stats: {
        collections: stats.collections,
        objects: stats.objects,
        dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
        storageSize: `${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`,
        indexes: stats.indexes,
      },
      uptime: process.uptime(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
    };
  }
};

// Query optimization utilities
const optimizeQuery = (model, query = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    populate = null,
    select = null,
    lean = true,
  } = options;

  let mongooseQuery = model.find(query);

  // Apply lean for better performance (returns plain JS objects)
  if (lean) {
    mongooseQuery = mongooseQuery.lean();
  }

  // Apply field selection
  if (select) {
    mongooseQuery = mongooseQuery.select(select);
  }

  // Apply population
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((pop) => {
        mongooseQuery = mongooseQuery.populate(pop);
      });
    } else {
      mongooseQuery = mongooseQuery.populate(populate);
    }
  }

  // Apply sorting
  mongooseQuery = mongooseQuery.sort(sort);

  // Apply pagination
  const skip = (page - 1) * limit;
  mongooseQuery = mongooseQuery.skip(skip).limit(limit);

  return mongooseQuery;
};

// Aggregation pipeline builder
const buildAggregationPipeline = (stages = []) => {
  const pipeline = [];

  stages.forEach((stage) => {
    switch (stage.type) {
      case "match":
        pipeline.push({ $match: stage.query });
        break;

      case "lookup":
        pipeline.push({
          $lookup: {
            from: stage.from,
            localField: stage.localField,
            foreignField: stage.foreignField,
            as: stage.as,
          },
        });
        break;

      case "unwind":
        pipeline.push({ $unwind: stage.path });
        break;

      case "group":
        pipeline.push({ $group: stage.group });
        break;

      case "sort":
        pipeline.push({ $sort: stage.sort });
        break;

      case "limit":
        pipeline.push({ $limit: stage.limit });
        break;

      case "skip":
        pipeline.push({ $skip: stage.skip });
        break;

      case "project":
        pipeline.push({ $project: stage.fields });
        break;

      case "addFields":
        pipeline.push({ $addFields: stage.fields });
        break;
    }
  });

  return pipeline;
};

// Database monitoring
const getConnectionStats = () => {
  const connection = mongoose.connection;

  return {
    readyState: connection.readyState,
    host: connection.host,
    port: connection.port,
    name: connection.name,
    collections: Object.keys(connection.collections),
    models: Object.keys(connection.models),
  };
};

module.exports = {
  connectDB,
  createIndexes,
  checkDatabaseHealth,
  optimizeQuery,
  buildAggregationPipeline,
  getConnectionStats,
};
