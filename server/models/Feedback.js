const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "bug_report",
        "feature_request",
        "general_feedback",
        "improvement",
        "complaint",
        "compliment",
      ],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "user_interface",
        "functionality",
        "performance",
        "content",
        "mobile_app",
        "website",
        "api",
        "other",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: [
        "open",
        "in_progress",
        "resolved",
        "closed",
        "duplicate",
        "wont_fix",
      ],
      default: "open",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: function () {
        return this.type === "general_feedback" || this.type === "compliment";
      },
    },
    // Technical details for bug reports
    technicalInfo: {
      browser: String,
      operatingSystem: String,
      deviceType: {
        type: String,
        enum: ["desktop", "mobile", "tablet"],
      },
      screenResolution: String,
      userAgent: String,
      url: String, // URL where issue occurred
      stepsToReproduce: [String],
      expectedBehavior: String,
      actualBehavior: String,
    },
    // Attachments (screenshots, logs, etc.)
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Admin response
    adminResponse: {
      responder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      message: String,
      respondedAt: Date,
      internalNotes: String, // Only visible to admins
    },
    // Tracking
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tags: [String],
    votes: {
      upvotes: {
        type: Number,
        default: 0,
      },
      downvotes: {
        type: Number,
        default: 0,
      },
      voters: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          vote: {
            type: String,
            enum: ["up", "down"],
          },
        },
      ],
    },
    // Follow-up communication
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: String,
        isAdminComment: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Resolution details
    resolution: {
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      resolvedAt: Date,
      resolution: String,
      version: String, // App version where fix was implemented
      releaseNotes: String,
    },
    // Metadata
    isPublic: {
      type: Boolean,
      default: true, // Whether feedback is visible to other users
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ["web", "mobile_app", "api", "email"],
      default: "web",
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ category: 1, priority: 1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ assignedTo: 1 });
feedbackSchema.index({ "votes.upvotes": -1 });

// Methods
feedbackSchema.methods.addComment = function (
  userId,
  message,
  isAdmin = false
) {
  this.comments.push({
    user: userId,
    message,
    isAdminComment: isAdmin,
  });
  return this.save();
};

feedbackSchema.methods.vote = function (userId, voteType) {
  // Remove existing vote if any
  this.votes.voters = this.votes.voters.filter((v) => !v.user.equals(userId));

  // Add new vote
  this.votes.voters.push({
    user: userId,
    vote: voteType,
  });

  // Update vote counts
  this.votes.upvotes = this.votes.voters.filter((v) => v.vote === "up").length;
  this.votes.downvotes = this.votes.voters.filter(
    (v) => v.vote === "down"
  ).length;

  return this.save();
};

feedbackSchema.methods.resolve = function (resolvedBy, resolution, version) {
  this.status = "resolved";
  this.resolution = {
    resolvedBy,
    resolvedAt: new Date(),
    resolution,
    version,
  };
  return this.save();
};

feedbackSchema.methods.toPublicJSON = function () {
  const feedback = this.toObject();

  if (feedback.isAnonymous) {
    delete feedback.user;
    delete feedback.ipAddress;
    delete feedback.userAgent;
  }

  // Remove admin-only fields
  delete feedback.adminResponse?.internalNotes;
  delete feedback.ipAddress;
  delete feedback.userAgent;

  return feedback;
};

// Static methods
feedbackSchema.statics.getFeedbackStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const typeStats = await this.aggregate([
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  return { statusStats: stats, typeStats };
};

feedbackSchema.statics.getPopularFeedback = async function (limit = 10) {
  return this.find({ isPublic: true })
    .sort({ "votes.upvotes": -1, createdAt: -1 })
    .limit(limit)
    .populate("user", "username avatar")
    .populate("resolution.resolvedBy", "username");
};

module.exports = mongoose.model("Feedback", feedbackSchema);
