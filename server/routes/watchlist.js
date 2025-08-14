const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { body, validationResult, query } = require("express-validator");
const { logger } = require("../utils/logger");
const User = require("../models/User");

// Validation middleware
const validateWatchlistItem = [
  body("movieId").isNumeric().withMessage("Movie ID must be a number"),
  body("title").notEmpty().trim().withMessage("Title is required"),
  body("posterPath").optional().isString(),
  body("releaseDate").optional().isISO8601(),
  body("genres").optional().isArray(),
  body("overview").optional().isString(),
  body("priority").optional().isIn(["low", "medium", "high"]),
  body("category")
    .optional()
    .isIn(["want_to_watch", "watching_soon", "watching_now"]),
  body("notes").optional().isString().isLength({ max: 500 }),
  body("reminderDate").optional().isISO8601(),
];

const validateWatchlistUpdate = [
  body("priority").optional().isIn(["low", "medium", "high"]),
  body("category")
    .optional()
    .isIn(["want_to_watch", "watching_soon", "watching_now"]),
  body("notes").optional().isString().isLength({ max: 500 }),
  body("reminderDate").optional().isISO8601(),
];

// Get user's watchlist
router.get("/", protect, async (req, res, next) => {
  try {
    const {
      category,
      priority,
      sortBy = "addedAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const user = await User.findById(req.user._id);
    let watchlist = [...user.watchlist];

    // Apply filters
    if (category) {
      watchlist = watchlist.filter((item) => item.category === category);
    }

    if (priority) {
      watchlist = watchlist.filter((item) => item.priority === priority);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      watchlist = watchlist.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          (item.overview &&
            item.overview.toLowerCase().includes(searchLower)) ||
          (item.notes && item.notes.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    watchlist.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (
        sortBy === "addedAt" ||
        sortBy === "updatedAt" ||
        sortBy === "reminderDate"
      ) {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedWatchlist = watchlist.slice(startIndex, endIndex);

    // Get statistics
    const stats = {
      total: watchlist.length,
      byCategory: {
        want_to_watch: watchlist.filter(
          (item) => item.category === "want_to_watch"
        ).length,
        watching_soon: watchlist.filter(
          (item) => item.category === "watching_soon"
        ).length,
        watching_now: watchlist.filter(
          (item) => item.category === "watching_now"
        ).length,
      },
      byPriority: {
        high: watchlist.filter((item) => item.priority === "high").length,
        medium: watchlist.filter((item) => item.priority === "medium").length,
        low: watchlist.filter((item) => item.priority === "low").length,
      },
      upcomingReminders: user.getUpcomingReminders().length,
    };

    res.json({
      watchlist: paginatedWatchlist,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: watchlist.length,
        pages: Math.ceil(watchlist.length / limit),
      },
      stats,
    });
  } catch (error) {
    next(error);
  }
});

// Add movie to watchlist
router.post("/add", protect, validateWatchlistItem, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const user = await User.findById(req.user._id);

    if (user.isInWatchlist(req.body.movieId)) {
      return res.status(400).json({
        error: "Movie already in watchlist",
      });
    }

    const movieData = {
      movieId: req.body.movieId,
      title: req.body.title,
      posterPath: req.body.posterPath,
      releaseDate: req.body.releaseDate,
      genres: req.body.genres,
      overview: req.body.overview,
    };

    const options = {
      priority: req.body.priority,
      category: req.body.category,
      notes: req.body.notes,
      reminderDate: req.body.reminderDate
        ? new Date(req.body.reminderDate)
        : null,
    };

    await user.addToWatchlist(movieData, options);

    logger.info(
      `Movie ${req.body.movieId} added to watchlist by user ${user.username}`
    );

    // Get the newly added item
    const addedItem = user.watchlist.find(
      (item) => item.movieId === req.body.movieId
    );

    res.status(201).json({
      message: "Movie added to watchlist",
      watchlistItem: addedItem,
    });
  } catch (error) {
    next(error);
  }
});

// Update watchlist item
router.patch(
  "/:movieId",
  protect,
  validateWatchlistUpdate,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const user = await User.findById(req.user._id);
      const movieId = parseInt(req.params.movieId);

      if (!user.isInWatchlist(movieId)) {
        return res.status(404).json({
          error: "Movie not found in watchlist",
        });
      }

      const updates = {};
      if (req.body.priority) updates.priority = req.body.priority;
      if (req.body.category) updates.category = req.body.category;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.reminderDate)
        updates.reminderDate = new Date(req.body.reminderDate);

      await user.updateWatchlistItem(movieId, updates);

      logger.info(`Watchlist item ${movieId} updated by user ${user.username}`);

      // Get the updated item
      const updatedItem = user.watchlist.find(
        (item) => item.movieId === movieId
      );

      res.json({
        message: "Watchlist item updated",
        watchlistItem: updatedItem,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove movie from watchlist
router.delete("/:movieId", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const movieId = parseInt(req.params.movieId);

    if (!user.isInWatchlist(movieId)) {
      return res.status(404).json({
        error: "Movie not found in watchlist",
      });
    }

    await user.removeFromWatchlist(movieId);

    logger.info(
      `Movie ${movieId} removed from watchlist by user ${user.username}`
    );

    res.json({
      message: "Movie removed from watchlist",
    });
  } catch (error) {
    next(error);
  }
});

// Get watchlist by category
router.get("/category/:category", protect, async (req, res, next) => {
  try {
    const { category } = req.params;
    const validCategories = ["want_to_watch", "watching_soon", "watching_now"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid category",
      });
    }

    const user = await User.findById(req.user._id);
    const categoryItems = user.getWatchlistByCategory(category);

    res.json({
      category,
      items: categoryItems,
      count: categoryItems.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get watchlist by priority
router.get("/priority/:priority", protect, async (req, res, next) => {
  try {
    const { priority } = req.params;
    const validPriorities = ["low", "medium", "high"];

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: "Invalid priority",
      });
    }

    const user = await User.findById(req.user._id);
    const priorityItems = user.getWatchlistByPriority(priority);

    res.json({
      priority,
      items: priorityItems,
      count: priorityItems.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming reminders
router.get("/reminders/upcoming", protect, async (req, res, next) => {
  try {
    const { days = 7 } = req.query;

    const user = await User.findById(req.user._id);
    const upcomingReminders = user.getUpcomingReminders(parseInt(days));

    res.json({
      reminders: upcomingReminders,
      count: upcomingReminders.length,
      daysAhead: parseInt(days),
    });
  } catch (error) {
    next(error);
  }
});

// Mark reminder as notified
router.patch(
  "/reminders/:movieId/notified",
  protect,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      const movieId = parseInt(req.params.movieId);

      const updates = { isNotified: true };
      await user.updateWatchlistItem(movieId, updates);

      logger.info(
        `Reminder marked as notified for movie ${movieId} by user ${user.username}`
      );

      res.json({
        message: "Reminder marked as notified",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Bulk update watchlist items
router.patch("/bulk-update", protect, async (req, res, next) => {
  try {
    const { movieIds, updates } = req.body;

    if (!movieIds || !Array.isArray(movieIds) || movieIds.length === 0) {
      return res.status(400).json({
        error: "movieIds array is required",
      });
    }

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({
        error: "updates object is required",
      });
    }

    const user = await User.findById(req.user._id);
    let updatedCount = 0;

    for (const movieId of movieIds) {
      const numericMovieId = parseInt(movieId);
      if (user.isInWatchlist(numericMovieId)) {
        await user.updateWatchlistItem(numericMovieId, updates);
        updatedCount++;
      }
    }

    logger.info(
      `Bulk update performed on ${updatedCount} watchlist items by user ${user.username}`
    );

    res.json({
      message: `${updatedCount} watchlist items updated`,
      updatedCount,
    });
  } catch (error) {
    next(error);
  }
});

// Get watchlist statistics
router.get("/statistics", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    const stats = {
      total: user.watchlist.length,
      byCategory: {
        want_to_watch: user.getWatchlistByCategory("want_to_watch").length,
        watching_soon: user.getWatchlistByCategory("watching_soon").length,
        watching_now: user.getWatchlistByCategory("watching_now").length,
      },
      byPriority: {
        high: user.getWatchlistByPriority("high").length,
        medium: user.getWatchlistByPriority("medium").length,
        low: user.getWatchlistByPriority("low").length,
      },
      reminders: {
        total: user.watchlist.filter((item) => item.reminderDate).length,
        upcoming: user.getUpcomingReminders().length,
        overdue: user.watchlist.filter(
          (item) =>
            item.reminderDate &&
            item.reminderDate < new Date() &&
            !item.isNotified
        ).length,
      },
      genres: user.watchlist.reduce((acc, item) => {
        if (item.genres) {
          item.genres.forEach((genre) => {
            acc[genre] = (acc[genre] || 0) + 1;
          });
        }
        return acc;
      }, {}),
      addedThisMonth: user.watchlist.filter((item) => {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return item.addedAt >= monthAgo;
      }).length,
    };

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

// Export watchlist
router.get("/export", protect, async (req, res, next) => {
  try {
    const { format = "json" } = req.query;
    const user = await User.findById(req.user._id);

    const exportData = {
      exportedAt: new Date(),
      user: {
        username: user.username,
        id: user._id,
      },
      watchlist: user.watchlist,
      statistics: {
        total: user.watchlist.length,
        byCategory: {
          want_to_watch: user.getWatchlistByCategory("want_to_watch").length,
          watching_soon: user.getWatchlistByCategory("watching_soon").length,
          watching_now: user.getWatchlistByCategory("watching_now").length,
        },
      },
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvHeader =
        "Movie ID,Title,Category,Priority,Added At,Release Date,Notes\n";
      const csvRows = user.watchlist
        .map(
          (item) =>
            `${item.movieId},"${item.title}","${item.category}","${
              item.priority
            }","${item.addedAt}","${item.releaseDate || ""}","${
              item.notes || ""
            }"`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="watchlist_${user.username}_${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(csvHeader + csvRows);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="watchlist_${user.username}_${
          new Date().toISOString().split("T")[0]
        }.json"`
      );
      res.json(exportData);
    }

    logger.info(
      `Watchlist exported by user ${user.username} in ${format} format`
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
