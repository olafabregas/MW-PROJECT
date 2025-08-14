const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth } = require("../middleware/auth");
const User = require("../models/User");
const Review = require("../models/Review");

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  [
    auth,
    body("username")
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores"
      ),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { username, email, avatar, preferences } = req.body;
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if username or email already exists (if being updated)
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Username already taken",
          });
        }
        user.username = username;
      }

      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Email already registered",
          });
        }
        user.email = email;
        user.isEmailVerified = false; // Reset email verification
      }

      if (avatar !== undefined) user.avatar = avatar;
      if (preferences) {
        user.preferences = { ...user.preferences, ...preferences };
      }

      await user.save();

      const updatedUser = user.toObject();
      delete updatedUser.password;

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   GET /api/users/watchlist
// @desc    Get user's watchlist
// @access  Private
router.get("/watchlist", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "addedAt" } = req.query;
    const user = await User.findById(req.userId).select("watchlist");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Sort watchlist
    let sortedWatchlist = [...user.watchlist];
    if (sort === "addedAt") {
      sortedWatchlist.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    } else if (sort === "title") {
      sortedWatchlist.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedWatchlist = sortedWatchlist.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedWatchlist,
      totalItems: user.watchlist.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(user.watchlist.length / limit),
    });
  } catch (error) {
    console.error("Get watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/users/watchlist
// @desc    Add movie to watchlist
// @access  Private
router.post(
  "/watchlist",
  [
    auth,
    body("movieId").isNumeric().withMessage("Movie ID must be a number"),
    body("title").notEmpty().withMessage("Movie title is required"),
    body("posterPath").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { movieId, title, posterPath } = req.body;
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isInWatchlist(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Movie already in watchlist",
        });
      }

      await user.addToWatchlist({ movieId, title, posterPath });

      res.json({
        success: true,
        message: "Movie added to watchlist",
        data: { movieId, title, posterPath },
      });
    } catch (error) {
      console.error("Add to watchlist error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/users/watchlist/:movieId
// @desc    Remove movie from watchlist
// @access  Private
router.delete("/watchlist/:movieId", auth, async (req, res) => {
  try {
    const { movieId } = req.params;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isInWatchlist(parseInt(movieId))) {
      return res.status(404).json({
        success: false,
        message: "Movie not in watchlist",
      });
    }

    await user.removeFromWatchlist(parseInt(movieId));

    res.json({
      success: true,
      message: "Movie removed from watchlist",
    });
  } catch (error) {
    console.error("Remove from watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/users/favorites
// @desc    Get user's favorites
// @access  Private
router.get("/favorites", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "addedAt" } = req.query;
    const user = await User.findById(req.userId).select("favorites");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Sort favorites
    let sortedFavorites = [...user.favorites];
    if (sort === "addedAt") {
      sortedFavorites.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    } else if (sort === "title") {
      sortedFavorites.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedFavorites = sortedFavorites.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedFavorites,
      totalItems: user.favorites.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(user.favorites.length / limit),
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/users/favorites
// @desc    Add movie to favorites
// @access  Private
router.post(
  "/favorites",
  [
    auth,
    body("movieId").isNumeric().withMessage("Movie ID must be a number"),
    body("title").notEmpty().withMessage("Movie title is required"),
    body("posterPath").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { movieId, title, posterPath } = req.body;
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isInFavorites(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Movie already in favorites",
        });
      }

      await user.addToFavorites({ movieId, title, posterPath });

      res.json({
        success: true,
        message: "Movie added to favorites",
        data: { movieId, title, posterPath },
      });
    } catch (error) {
      console.error("Add to favorites error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/users/favorites/:movieId
// @desc    Remove movie from favorites
// @access  Private
router.delete("/favorites/:movieId", auth, async (req, res) => {
  try {
    const { movieId } = req.params;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isInFavorites(parseInt(movieId))) {
      return res.status(404).json({
        success: false,
        message: "Movie not in favorites",
      });
    }

    await user.removeFromFavorites(parseInt(movieId));

    res.json({
      success: true,
      message: "Movie removed from favorites",
    });
  } catch (error) {
    console.error("Remove from favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/users/watched
// @desc    Get user's watched movies
// @access  Private
router.get("/watched", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = "watchedAt", status } = req.query;
    const user = await User.findById(req.userId).select("watchedMovies");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let watchedMovies = [...user.watchedMovies];

    // Filter by status if provided
    if (status) {
      watchedMovies = watchedMovies.filter((movie) => movie.status === status);
    }

    // Sort watched movies
    if (sort === "watchedAt") {
      watchedMovies.sort(
        (a, b) => new Date(b.watchedAt) - new Date(a.watchedAt)
      );
    } else if (sort === "title") {
      watchedMovies.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "rating") {
      watchedMovies.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedWatched = watchedMovies.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedWatched,
      totalItems: watchedMovies.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(watchedMovies.length / limit),
    });
  } catch (error) {
    console.error("Get watched movies error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/users/watched
// @desc    Add movie to watched list or update status
// @access  Private
router.post(
  "/watched",
  [
    auth,
    body("movieId").isNumeric().withMessage("Movie ID must be a number"),
    body("title").notEmpty().withMessage("Movie title is required"),
    body("status")
      .isIn(["watched", "watching", "to-watch"])
      .withMessage("Invalid status"),
    body("rating")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("posterPath").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { movieId, title, status, rating, posterPath } = req.body;
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Find existing watched movie
      const existingIndex = user.watchedMovies.findIndex(
        (movie) => movie.movieId === movieId
      );

      if (existingIndex !== -1) {
        // Update existing entry
        user.watchedMovies[existingIndex].status = status;
        if (rating) user.watchedMovies[existingIndex].rating = rating;
        user.watchedMovies[existingIndex].watchedAt = new Date();
      } else {
        // Add new entry
        user.watchedMovies.push({
          movieId,
          title,
          posterPath,
          status,
          rating,
          watchedAt: new Date(),
        });
      }

      // Update stats
      if (status === "watched") {
        user.stats.totalMoviesWatched = user.watchedMovies.filter(
          (movie) => movie.status === "watched"
        ).length;
      }

      await user.save();

      res.json({
        success: true,
        message: "Movie status updated successfully",
        data: { movieId, title, status, rating },
      });
    } catch (error) {
      console.error("Update watched status error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get("/stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "stats watchedMovies favorites watchlist badges"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate additional stats
    const watchedThisMonth = user.watchedMovies.filter((movie) => {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(movie.watchedAt) > monthAgo && movie.status === "watched";
    }).length;

    const averageRating = user.watchedMovies
      .filter((movie) => movie.rating)
      .reduce((acc, movie, _, arr) => acc + movie.rating / arr.length, 0);

    const stats = {
      ...user.stats,
      watchlistCount: user.watchlist.length,
      favoritesCount: user.favorites.length,
      badgesCount: user.badges.length,
      watchedThisMonth,
      averageRating: Math.round(averageRating * 10) / 10 || 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/users/:userId/public
// @desc    Get user's public profile
// @access  Public
router.get("/:userId/public", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select(
      "username avatar badges stats createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user.toPublicJSON(),
    });
  } catch (error) {
    console.error("Get public profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
