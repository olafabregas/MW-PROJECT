const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    movieId: {
      type: Number,
      required: true,
    },
    movieTitle: {
      type: String,
      required: true,
    },
    moviePoster: String,

    // Review content
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    // Moderation
    isApproved: {
      type: Boolean,
      default: true,
    },
    moderationNote: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: Date,

    // Engagement
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    dislikes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        dislikedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        content: {
          type: String,
          required: true,
          maxlength: 500,
        },
        reactions: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
            },
            emoji: {
              type: String,
              enum: ["😂", "😍", "😱", "😢", "😡", "👍", "👎", "❤️"],
            },
            reactedAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Flags and reports
    flags: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reason: {
          type: String,
          enum: [
            "spam",
            "inappropriate",
            "offensive",
            "spoiler",
            "fake",
            "other",
          ],
        },
        description: String,
        flaggedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Metadata
    spoilerWarning: {
      type: Boolean,
      default: false,
    },

    helpfulCount: {
      type: Number,
      default: 0,
    },

    // SEO and search
    tags: [String],

    // Edit history
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
reviewSchema.index({ movieId: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isApproved: 1 });
reviewSchema.index({ "likes.user": 1 });

// Virtual for like count
reviewSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

// Virtual for dislike count
reviewSchema.virtual("dislikeCount").get(function () {
  return this.dislikes.length;
});

// Virtual for comment count
reviewSchema.virtual("commentCount").get(function () {
  return this.comments.length;
});

// Virtual for flag count
reviewSchema.virtual("flagCount").get(function () {
  return this.flags.length;
});

// Check if user has liked the review
reviewSchema.methods.isLikedBy = function (userId) {
  return this.likes.some((like) => like.user.toString() === userId.toString());
};

// Check if user has disliked the review
reviewSchema.methods.isDislikedBy = function (userId) {
  return this.dislikes.some(
    (dislike) => dislike.user.toString() === userId.toString()
  );
};

// Add like
reviewSchema.methods.addLike = function (userId) {
  if (!this.isLikedBy(userId)) {
    // Remove dislike if exists
    this.dislikes = this.dislikes.filter(
      (dislike) => dislike.user.toString() !== userId.toString()
    );

    // Add like
    this.likes.push({ user: userId });
  }
  return this.save();
};

// Remove like
reviewSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter(
    (like) => like.user.toString() !== userId.toString()
  );
  return this.save();
};

// Add dislike
reviewSchema.methods.addDislike = function (userId) {
  if (!this.isDislikedBy(userId)) {
    // Remove like if exists
    this.likes = this.likes.filter(
      (like) => like.user.toString() !== userId.toString()
    );

    // Add dislike
    this.dislikes.push({ user: userId });
  }
  return this.save();
};

// Remove dislike
reviewSchema.methods.removeDislike = function (userId) {
  this.dislikes = this.dislikes.filter(
    (dislike) => dislike.user.toString() !== userId.toString()
  );
  return this.save();
};

// Add comment
reviewSchema.methods.addComment = function (commentData) {
  this.comments.push(commentData);
  return this.save();
};

// Add flag
reviewSchema.methods.addFlag = function (flagData) {
  const existingFlag = this.flags.find(
    (flag) => flag.user.toString() === flagData.user.toString()
  );

  if (!existingFlag) {
    this.flags.push(flagData);
    return this.save();
  }

  return Promise.resolve(this);
};

// Get safe review data (excluding sensitive information)
reviewSchema.methods.toSafeJSON = function () {
  const review = this.toObject();

  // Remove sensitive data
  delete review.flags;
  delete review.editHistory;

  return {
    ...review,
    likeCount: this.likeCount,
    dislikeCount: this.dislikeCount,
    commentCount: this.commentCount,
  };
};

// Pre-save middleware to update helpful count
reviewSchema.pre("save", function (next) {
  this.helpfulCount = this.likes.length - this.dislikes.length;
  next();
});

module.exports = mongoose.model("Review", reviewSchema);
