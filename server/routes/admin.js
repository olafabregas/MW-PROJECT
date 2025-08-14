const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth, adminOnly, moderatorOrAdmin } = require("../middleware/auth");
const User = require("../models/User");
const Review = require("../models/Review");

const router = express.Router();

// All admin routes require authentication
router.use(auth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Admin Only
router.get("/dashboard", adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    const sevenDaysAgo = new Date(now.setDate(now.getDate() + 23)); // Reset and go back 7 days

    // User statistics
    const totalUsers = await User.countDocuments();
    const newUsersLast30Days = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });
    const newUsersLast7Days = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    // Review statistics
    const totalReviews = await Review.countDocuments({ isApproved: true });
    const pendingReviews = await Review.countDocuments({ isApproved: false });
    const flaggedReviews = await Review.countDocuments({
      "flags.0": { $exists: true },
      isApproved: true,
    });

    // Most active users (by review count)
    const mostActiveUsers = await Review.aggregate([
      { $match: { isApproved: true } },
      { $group: { _id: "$user", reviewCount: { $sum: 1 } } },
      { $sort: { reviewCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          reviewCount: 1,
          "user.username": 1,
          "user.avatar": 1,
        },
      },
    ]);

    // Most reviewed movies
    const mostReviewedMovies = await Review.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: "$movieId",
          reviewCount: { $sum: 1 },
          movieTitle: { $first: "$movieTitle" },
          moviePoster: { $first: "$moviePoster" },
          averageRating: { $avg: "$rating" },
        },
      },
      { $sort: { reviewCount: -1 } },
      { $limit: 10 },
    ]);

    // Daily active users (approximation based on recent reviews/activity)
    const dailyActiveUsers = await Review.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newLast30Days: newUsersLast30Days,
          newLast7Days: newUsersLast7Days,
          dailyActive: dailyActiveUsers,
        },
        reviews: {
          total: totalReviews,
          pending: pendingReviews,
          flagged: flaggedReviews,
        },
        mostActiveUsers,
        mostReviewedMovies,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filters
// @access  Admin Only
router.get("/users", adminOnly, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) {
      query.role = role;
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = order === "desc" ? -1 : 1;

    // Execute query
    const users = await User.find(query)
      .select("-password -passwordResetToken -emailVerificationToken")
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalUsers = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNextPage: page < Math.ceil(totalUsers / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Admin Only
router.put(
  "/users/:id/role",
  [
    adminOnly,
    body("role")
      .isIn(["user", "moderator", "admin"])
      .withMessage("Invalid role"),
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

      const { id } = req.params;
      const { role } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent admin from demoting themselves
      if (user._id.toString() === req.userId.toString() && role !== "admin") {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own role",
        });
      }

      user.role = role;
      await user.save();

      res.json({
        success: true,
        message: "User role updated successfully",
        data: { userId: user._id, role: user.role },
      });
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (soft delete by deactivating)
// @access  Admin Only
router.delete("/users/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Soft delete - just update username and email to indicate deletion
    user.username = `deleted_${user._id}`;
    user.email = `deleted_${user._id}@deleted.com`;
    user.role = "user";
    await user.save();

    // Also set their reviews to not approved
    await Review.updateMany(
      { user: id },
      { isApproved: false, moderationNote: "User account deleted" }
    );

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   GET /api/admin/reviews
// @desc    Get all reviews for moderation
// @access  Moderator/Admin
router.get("/reviews", moderatorOrAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "all", // all, pending, approved, flagged
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build query based on status
    let query = {};
    if (status === "pending") {
      query.isApproved = false;
    } else if (status === "approved") {
      query.isApproved = true;
    } else if (status === "flagged") {
      query = {
        "flags.0": { $exists: true },
        isApproved: true,
      };
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = order === "desc" ? -1 : 1;

    // Execute query
    const reviews = await Review.find(query)
      .populate("user", "username avatar role")
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalReviews = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        hasNextPage: page < Math.ceil(totalReviews / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get reviews for moderation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/admin/reviews/:id/approve
// @desc    Approve a review
// @access  Moderator/Admin
router.put("/reviews/:id/approve", moderatorOrAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.isApproved = true;
    review.moderatedBy = req.userId;
    review.moderatedAt = new Date();
    review.moderationNote = "Approved by moderator";

    await review.save();

    res.json({
      success: true,
      message: "Review approved successfully",
    });
  } catch (error) {
    console.error("Approve review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/admin/reviews/:id/reject
// @desc    Reject a review
// @access  Moderator/Admin
router.put(
  "/reviews/:id/reject",
  [
    moderatorOrAdmin,
    body("reason").notEmpty().withMessage("Rejection reason is required"),
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

      const { reason } = req.body;

      review.isApproved = false;
      review.moderatedBy = req.userId;
      review.moderatedAt = new Date();
      review.moderationNote = reason;

      await review.save();

      res.json({
        success: true,
        message: "Review rejected successfully",
      });
    } catch (error) {
      console.error("Reject review error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// @route   DELETE /api/admin/reviews/:id
// @desc    Delete a review
// @access  Moderator/Admin
router.delete("/reviews/:id", moderatorOrAdmin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
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

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Admin Only
router.get("/analytics", adminOnly, async (req, res) => {
  try {
    const { period = "30" } = req.query; // days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // User growth analytics
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Review analytics
    const reviewAnalytics = await Review.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          isApproved: true,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Top genres (based on reviewed movies)
    const topGenres = await Review.aggregate([
      {
        $match: {
          isApproved: true,
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: "$movieId",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // User engagement metrics
    const engagementMetrics = await Review.aggregate([
      {
        $match: {
          isApproved: true,
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          totalLikes: { $sum: { $size: "$likes" } },
          totalComments: { $sum: { $size: "$comments" } },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        userGrowth,
        reviewAnalytics,
        topGenres,
        engagementMetrics: engagementMetrics[0] || {
          totalReviews: 0,
          totalLikes: 0,
          totalComments: 0,
          averageRating: 0,
        },
        period: parseInt(period),
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
