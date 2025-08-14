const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");
const { protect, restrictTo } = require("../middleware/auth");
const { body, validationResult, query } = require("express-validator");
const { logger } = require("../utils/logger");

// Validation middleware
const validateFeedback = [
  body("type").isIn([
    "bug_report",
    "feature_request",
    "general_feedback",
    "improvement",
    "complaint",
    "compliment",
  ]),
  body("category").isIn([
    "user_interface",
    "functionality",
    "performance",
    "content",
    "mobile_app",
    "website",
    "api",
    "other",
  ]),
  body("title").isLength({ min: 5, max: 200 }).trim(),
  body("description").isLength({ min: 10, max: 2000 }).trim(),
  body("priority").optional().isIn(["low", "medium", "high", "critical"]),
  body("rating").optional().isInt({ min: 1, max: 5 }),
  body("isAnonymous").optional().isBoolean(),
];

const validateComment = [
  body("message").isLength({ min: 1, max: 1000 }).trim(),
];

const validateVote = [body("voteType").isIn(["up", "down"])];

// Submit new feedback
router.post("/", protect, validateFeedback, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const {
      type,
      category,
      title,
      description,
      priority,
      rating,
      technicalInfo,
      isAnonymous,
      tags,
    } = req.body;

    // Get technical info from request headers
    const defaultTechnicalInfo = {
      userAgent: req.get("User-Agent"),
      url: req.get("Referer"),
      ...technicalInfo,
    };

    const feedback = new Feedback({
      user: req.user._id,
      type,
      category,
      title,
      description,
      priority: priority || "medium",
      rating,
      technicalInfo: defaultTechnicalInfo,
      isAnonymous: isAnonymous || false,
      tags: tags || [],
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      source: "web",
    });

    await feedback.save();

    logger.info(`New feedback submitted by user ${req.user.username}:`, {
      feedbackId: feedback._id,
      type: feedback.type,
      category: feedback.category,
      title: feedback.title,
    });

    // Populate user data for response
    await feedback.populate("user", "username avatar");

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback: feedback.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// Get public feedback (for community feedback page)
router.get("/public", async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      status,
      sortBy = "votes",
    } = req.query;

    const filter = { isPublic: true };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;

    let sort = {};
    switch (sortBy) {
      case "votes":
        sort = { "votes.upvotes": -1, createdAt: -1 };
        break;
      case "recent":
        sort = { createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      default:
        sort = { "votes.upvotes": -1, createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [feedback, total] = await Promise.all([
      Feedback.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "username avatar")
        .populate("resolution.resolvedBy", "username"),
      Feedback.countDocuments(filter),
    ]);

    const publicFeedback = feedback.map((f) => f.toPublicJSON());

    res.json({
      feedback: publicFeedback,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get user's own feedback
router.get("/my-feedback", protect, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;

    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (page - 1) * limit;

    const [feedback, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("adminResponse.responder", "username")
        .populate("resolution.resolvedBy", "username"),
      Feedback.countDocuments(filter),
    ]);

    res.json({
      feedback,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get specific feedback by ID
router.get("/:id", async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate("user", "username avatar")
      .populate("comments.user", "username avatar")
      .populate("adminResponse.responder", "username")
      .populate("resolution.resolvedBy", "username");

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    // Check if user can view this feedback
    const canView =
      feedback.isPublic ||
      (req.user && feedback.user.equals(req.user._id)) ||
      (req.user && req.user.role === "admin");

    if (!canView) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      feedback: feedback.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// Vote on feedback
router.post("/:id/vote", protect, validateVote, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    if (!feedback.isPublic) {
      return res.status(403).json({ error: "Cannot vote on private feedback" });
    }

    await feedback.vote(req.user._id, req.body.voteType);

    res.json({
      message: "Vote recorded",
      votes: {
        upvotes: feedback.votes.upvotes,
        downvotes: feedback.votes.downvotes,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Add comment to feedback
router.post(
  "/:id/comments",
  protect,
  validateComment,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const feedback = await Feedback.findById(req.params.id);

      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      // Check if user can comment
      const canComment =
        feedback.user.equals(req.user._id) ||
        req.user.role === "admin" ||
        req.user.role === "moderator";

      if (!canComment) {
        return res
          .status(403)
          .json({ error: "Cannot comment on this feedback" });
      }

      const isAdmin =
        req.user.role === "admin" || req.user.role === "moderator";
      await feedback.addComment(req.user._id, req.body.message, isAdmin);

      // Populate the new comment
      await feedback.populate("comments.user", "username avatar");

      const newComment = feedback.comments[feedback.comments.length - 1];

      logger.info(
        `Comment added to feedback ${feedback._id} by ${req.user.username}`
      );

      res.json({
        message: "Comment added",
        comment: newComment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin routes
router.get(
  "/admin/all",
  protect,
  restrictTo("admin", "moderator"),
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        type,
        category,
        priority,
        assignedTo,
      } = req.query;

      const filter = {};

      if (status) filter.status = status;
      if (type) filter.type = type;
      if (category) filter.category = category;
      if (priority) filter.priority = priority;
      if (assignedTo) filter.assignedTo = assignedTo;

      const skip = (page - 1) * limit;

      const [feedback, total, stats] = await Promise.all([
        Feedback.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate("user", "username avatar email")
          .populate("assignedTo", "username")
          .populate("adminResponse.responder", "username"),
        Feedback.countDocuments(filter),
        Feedback.getFeedbackStats(),
      ]);

      res.json({
        feedback,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: Update feedback status
router.patch(
  "/admin/:id/status",
  protect,
  restrictTo("admin", "moderator"),
  async (req, res, next) => {
    try {
      const { status, assignedTo, internalNotes } = req.body;

      const feedback = await Feedback.findById(req.params.id);

      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      if (status) feedback.status = status;
      if (assignedTo) feedback.assignedTo = assignedTo;

      if (internalNotes) {
        if (!feedback.adminResponse) {
          feedback.adminResponse = {};
        }
        feedback.adminResponse.internalNotes = internalNotes;
      }

      await feedback.save();

      logger.info(
        `Feedback ${feedback._id} updated by admin ${req.user.username}:`,
        {
          status: feedback.status,
          assignedTo: feedback.assignedTo,
        }
      );

      res.json({
        message: "Feedback updated",
        feedback,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: Respond to feedback
router.post(
  "/admin/:id/respond",
  protect,
  restrictTo("admin", "moderator"),
  async (req, res, next) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Response message is required" });
      }

      const feedback = await Feedback.findById(req.params.id);

      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      feedback.adminResponse = {
        responder: req.user._id,
        message,
        respondedAt: new Date(),
      };

      await feedback.save();

      logger.info(
        `Admin response added to feedback ${feedback._id} by ${req.user.username}`
      );

      res.json({
        message: "Response added",
        adminResponse: feedback.adminResponse,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: Resolve feedback
router.post(
  "/admin/:id/resolve",
  protect,
  restrictTo("admin", "moderator"),
  async (req, res, next) => {
    try {
      const { resolution, version, releaseNotes } = req.body;

      if (!resolution) {
        return res
          .status(400)
          .json({ error: "Resolution message is required" });
      }

      const feedback = await Feedback.findById(req.params.id);

      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }

      await feedback.resolve(req.user._id, resolution, version);

      if (releaseNotes) {
        feedback.resolution.releaseNotes = releaseNotes;
        await feedback.save();
      }

      logger.info(
        `Feedback ${feedback._id} resolved by admin ${req.user.username}`
      );

      res.json({
        message: "Feedback resolved",
        resolution: feedback.resolution,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get feedback statistics
router.get(
  "/admin/statistics",
  protect,
  restrictTo("admin"),
  async (req, res, next) => {
    try {
      const stats = await Feedback.getFeedbackStats();
      const popularFeedback = await Feedback.getPopularFeedback(5);

      const monthlyStats = await Feedback.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]);

      res.json({
        stats,
        popularFeedback,
        monthlyStats,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
