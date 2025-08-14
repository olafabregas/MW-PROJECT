const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth, moderatorOrAdmin } = require("../middleware/auth");
const Review = require("../models/Review");
const User = require("../models/User");

const router = express.Router();

// @route   GET /api/reviews
// @desc    Get reviews with filters
// @access  Public
router.get("/", async (req, res) => {
  try {
    const {
      movieId,
      userId,
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      minRating,
      maxRating,
    } = req.query;

    // Build query
    const query = { isApproved: true };

    if (movieId) query.movieId = parseInt(movieId);
    if (userId) query.user = userId;
    if (minRating)
      query.rating = { ...query.rating, $gte: parseInt(minRating) };
    if (maxRating)
      query.rating = { ...query.rating, $lte: parseInt(maxRating) };

    // Build sort object
    const sortObj = {};
    sortObj[sort] = order === "desc" ? -1 : 1;

    // Execute query with pagination
    const reviews = await Review.find(query)
      .populate("user", "username avatar badges")
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count for pagination
    const totalReviews = await Review.countDocuments(query);

    // Add computed fields
    const reviewsWithCounts = reviews.map((review) => ({
      ...review,
      likeCount: review.likes?.length || 0,
      dislikeCount: review.dislikes?.length || 0,
      commentCount: review.comments?.length || 0,
    }));

    res.json({
      reviews: reviewsWithCounts,
      totalReviews,
      totalPages: Math.ceil(totalReviews / limit),
      currentPage: parseInt(page),
      hasNextPage: page < Math.ceil(totalReviews / limit),
      hasPrevPage: page > 1,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/reviews/:id
// @desc    Get single review
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("user", "username avatar badges")
      .populate("comments.user", "username avatar")
      .lean();

    if (!review || !review.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Add computed fields
    const reviewWithCounts = {
      ...review,
      likeCount: review.likes?.length || 0,
      dislikeCount: review.dislikes?.length || 0,
      commentCount: review.comments?.length || 0,
    };

    res.json({
      success: true,
      data: reviewWithCounts,
    });
  } catch (error) {
    console.error("Get review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/reviews
// @desc    Create a new review
// @access  Private
router.post(
  "/",
  [
    auth,
    body("movieId").isNumeric().withMessage("Movie ID must be a number"),
    body("movieTitle").notEmpty().withMessage("Movie title is required"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("title")
      .isLength({ min: 5, max: 100 })
      .withMessage("Title must be between 5 and 100 characters"),
    body("content")
      .isLength({ min: 10, max: 2000 })
      .withMessage("Content must be between 10 and 2000 characters"),
    body("spoilerWarning").optional().isBoolean(),
    body("moviePoster").optional().isString(),
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

      const {
        movieId,
        movieTitle,
        rating,
        title,
        content,
        spoilerWarning,
        moviePoster,
      } = req.body;

      // Check if user already reviewed this movie
      const existingReview = await Review.findOne({
        user: req.userId,
        movieId: parseInt(movieId),
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: "You have already reviewed this movie",
        });
      }

      // Create new review
      const review = new Review({
        user: req.userId,
        movieId: parseInt(movieId),
        movieTitle,
        moviePoster,
        rating,
        title,
        content,
        spoilerWarning: spoilerWarning || false,
      });

      await review.save();

      // Update user stats
      await User.findByIdAndUpdate(req.userId, {
        $inc: { "stats.totalReviews": 1 },
      });

      // Populate user data for response
      await review.populate("user", "username avatar badges");

      res.status(201).json({
        success: true,
        message: "Review created successfully",
        data: review.toSafeJSON(),
      });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private
router.put(
  "/:id",
  [
    auth,
    body("rating")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("title")
      .optional()
      .isLength({ min: 5, max: 100 })
      .withMessage("Title must be between 5 and 100 characters"),
    body("content")
      .optional()
      .isLength({ min: 10, max: 2000 })
      .withMessage("Content must be between 10 and 2000 characters"),
    body("spoilerWarning").optional().isBoolean(),
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

      const review = await Review.findById(req.params.id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        });
      }

      // Check if user owns this review
      if (review.user.toString() !== req.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own reviews",
        });
      }

      const { rating, title, content, spoilerWarning } = req.body;

      // Store previous content in edit history
      if (content && content !== review.content) {
        review.editHistory.push({
          content: review.content,
          editedAt: new Date(),
        });
      }

      // Update review
      if (rating !== undefined) review.rating = rating;
      if (title !== undefined) review.title = title;
      if (content !== undefined) review.content = content;
      if (spoilerWarning !== undefined) review.spoilerWarning = spoilerWarning;

      review.updatedAt = new Date();

      await review.save();
      await review.populate("user", "username avatar badges");

      res.json({
        success: true,
        message: "Review updated successfully",
        data: review.toSafeJSON(),
      });
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user owns this review or is a moderator/admin
    const user = await User.findById(req.userId);
    if (
      review.user.toString() !== req.userId.toString() &&
      !["moderator", "admin"].includes(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reviews",
      });
    }

    await Review.findByIdAndDelete(req.params.id);

    // Update user stats
    await User.findByIdAndUpdate(review.user, {
      $inc: { "stats.totalReviews": -1 },
    });

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/reviews/:id/like
// @desc    Like a review
// @access  Private
router.post("/:id/like", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review || !review.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    await review.addLike(req.userId);

    res.json({
      success: true,
      message: "Review liked successfully",
      data: {
        likeCount: review.likes.length,
        dislikeCount: review.dislikes.length,
      },
    });
  } catch (error) {
    console.error("Like review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/reviews/:id/like
// @desc    Remove like from review
// @access  Private
router.delete("/:id/like", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review || !review.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    await review.removeLike(req.userId);

    res.json({
      success: true,
      message: "Like removed successfully",
      data: {
        likeCount: review.likes.length,
        dislikeCount: review.dislikes.length,
      },
    });
  } catch (error) {
    console.error("Remove like error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/reviews/:id/dislike
// @desc    Dislike a review
// @access  Private
router.post("/:id/dislike", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review || !review.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    await review.addDislike(req.userId);

    res.json({
      success: true,
      message: "Review disliked successfully",
      data: {
        likeCount: review.likes.length,
        dislikeCount: review.dislikes.length,
      },
    });
  } catch (error) {
    console.error("Dislike review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   DELETE /api/reviews/:id/dislike
// @desc    Remove dislike from review
// @access  Private
router.delete("/:id/dislike", auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review || !review.isApproved) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    await review.removeDislike(req.userId);

    res.json({
      success: true,
      message: "Dislike removed successfully",
      data: {
        likeCount: review.likes.length,
        dislikeCount: review.dislikes.length,
      },
    });
  } catch (error) {
    console.error("Remove dislike error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   POST /api/reviews/:id/comments
// @desc    Add comment to review
// @access  Private
router.post(
  "/:id/comments",
  [
    auth,
    body("content")
      .isLength({ min: 1, max: 500 })
      .withMessage("Comment must be between 1 and 500 characters"),
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

      const review = await Review.findById(req.params.id);

      if (!review || !review.isApproved) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        });
      }

      const { content } = req.body;

      await review.addComment({
        user: req.userId,
        content,
      });

      // Get the newly added comment with user data
      const updatedReview = await Review.findById(req.params.id)
        .populate("comments.user", "username avatar")
        .select("comments");

      const newComment =
        updatedReview.comments[updatedReview.comments.length - 1];

      res.status(201).json({
        success: true,
        message: "Comment added successfully",
        data: newComment,
      });
    } catch (error) {
      console.error("Add comment error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   POST /api/reviews/:id/flag
// @desc    Flag a review for moderation
// @access  Private
router.post(
  "/:id/flag",
  [
    auth,
    body("reason")
      .isIn(["spam", "inappropriate", "offensive", "spoiler", "fake", "other"])
      .withMessage("Invalid flag reason"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description must be 500 characters or less"),
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

      const review = await Review.findById(req.params.id);

      if (!review || !review.isApproved) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        });
      }

      const { reason, description } = req.body;

      await review.addFlag({
        user: req.userId,
        reason,
        description,
      });

      res.json({
        success: true,
        message: "Review flagged for moderation",
      });
    } catch (error) {
      console.error("Flag review error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

module.exports = router;
