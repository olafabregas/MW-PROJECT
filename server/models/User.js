const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Password not required if using Google auth
      },
      minlength: 6,
    },
    googleId: {
      type: String,
      sparse: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "moderator", "admin"],
      default: "user",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // User preferences
    preferences: {
      darkMode: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
      },
    },

    // User movie data
    watchlist: [
      {
        movieId: {
          type: Number,
          required: true,
        },
        title: String,
        posterPath: String,
        releaseDate: String,
        genres: [String],
        overview: String,
        priority: {
          type: String,
          enum: ["low", "medium", "high"],
          default: "medium",
        },
        category: {
          type: String,
          enum: ["want_to_watch", "watching_soon", "watching_now"],
          default: "want_to_watch",
        },
        notes: String,
        reminderDate: Date,
        isNotified: {
          type: Boolean,
          default: false,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    favorites: [
      {
        movieId: {
          type: Number,
          required: true,
        },
        title: String,
        posterPath: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    watchedMovies: [
      {
        movieId: {
          type: Number,
          required: true,
        },
        title: String,
        posterPath: String,
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        watchedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["watched", "watching", "to-watch"],
          default: "watched",
        },
      },
    ],

    // Social features
    friends: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "blocked"],
          default: "pending",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Gamification
    badges: [
      {
        name: String,
        description: String,
        icon: String,
        earnedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    stats: {
      totalMoviesWatched: {
        type: Number,
        default: 0,
      },
      totalReviews: {
        type: Number,
        default: 0,
      },
      totalWatchTime: {
        type: Number,
        default: 0, // in minutes
      },
      favoriteGenres: [String],
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // Multiple profiles (Premium feature)
    profiles: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: 50,
        },
        avatar: {
          type: String,
          default: "",
        },
        profilePicture: {
          type: String,
          default: "",
        },
        isKidsProfile: {
          type: Boolean,
          default: false,
        },
        ageRating: {
          type: String,
          enum: ["G", "PG", "PG-13", "R", "NC-17", "all"],
          default: function () {
            return this.isKidsProfile ? "PG" : "all";
          },
        },
        preferences: {
          darkMode: {
            type: Boolean,
            default: true,
          },
          language: {
            type: String,
            default: "en",
          },
          notifications: {
            email: {
              type: Boolean,
              default: true,
            },
            push: {
              type: Boolean,
              default: true,
            },
          },
          favoriteGenres: [String],
          autoplay: {
            type: Boolean,
            default: true,
          },
          subtitles: {
            type: Boolean,
            default: false,
          },
          audioLanguage: {
            type: String,
            default: "en",
          },
        },
        watchHistory: [
          {
            movieId: {
              type: Number,
              required: true,
            },
            title: String,
            posterPath: String,
            watchedAt: {
              type: Date,
              default: Date.now,
            },
            watchDuration: Number, // in minutes
            totalDuration: Number, // total movie duration
            completed: {
              type: Boolean,
              default: false,
            },
          },
        ],
        recommendations: [
          {
            movieId: {
              type: Number,
              required: true,
            },
            title: String,
            posterPath: String,
            reason: String, // Why this was recommended
            score: {
              type: Number,
              min: 0,
              max: 1,
            },
            generatedAt: {
              type: Date,
              default: Date.now,
            },
            viewed: {
              type: Boolean,
              default: false,
            },
          },
        ],
        isActive: {
          type: Boolean,
          default: true,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastUsedAt: {
          type: Date,
          default: Date.now,
        },
        pin: {
          type: String,
          minlength: 4,
          maxlength: 6,
        },
        isProtected: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Subscription info
    subscription: {
      plan: {
        type: String,
        enum: ["free", "premium"],
        default: "free",
      },
      expiresAt: Date,
      stripeCustomerId: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better performance
userSchema.index({ "watchlist.movieId": 1 });
userSchema.index({ "favorites.movieId": 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if movie is in watchlist
userSchema.methods.isInWatchlist = function (movieId) {
  return this.watchlist.some((item) => item.movieId === movieId);
};

// Check if movie is in favorites
userSchema.methods.isInFavorites = function (movieId) {
  return this.favorites.some((item) => item.movieId === movieId);
};

// Add movie to watchlist with enhanced features
userSchema.methods.addToWatchlist = function (movieData, options = {}) {
  if (!this.isInWatchlist(movieData.movieId)) {
    const watchlistItem = {
      ...movieData,
      priority: options.priority || "medium",
      category: options.category || "want_to_watch",
      notes: options.notes || "",
      reminderDate: options.reminderDate || null,
      addedAt: new Date(),
      updatedAt: new Date(),
    };
    this.watchlist.push(watchlistItem);
  }
  return this.save();
};

// Update watchlist item
userSchema.methods.updateWatchlistItem = function (movieId, updates) {
  const item = this.watchlist.find((item) => item.movieId === movieId);
  if (item) {
    Object.assign(item, updates);
    item.updatedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Get watchlist by category
userSchema.methods.getWatchlistByCategory = function (category) {
  return this.watchlist.filter((item) => item.category === category);
};

// Get watchlist by priority
userSchema.methods.getWatchlistByPriority = function (priority) {
  return this.watchlist.filter((item) => item.priority === priority);
};

// Get watchlist items with upcoming reminders
userSchema.methods.getUpcomingReminders = function (daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.watchlist.filter(
    (item) =>
      item.reminderDate && item.reminderDate <= futureDate && !item.isNotified
  );
};

// Remove movie from watchlist
userSchema.methods.removeFromWatchlist = function (movieId) {
  this.watchlist = this.watchlist.filter((item) => item.movieId !== movieId);
  return this.save();
};

// Add movie to favorites
userSchema.methods.addToFavorites = function (movieData) {
  if (!this.isInFavorites(movieData.movieId)) {
    this.favorites.push(movieData);
  }
  return this.save();
};

// Remove movie from favorites
userSchema.methods.removeFromFavorites = function (movieId) {
  this.favorites = this.favorites.filter((item) => item.movieId !== movieId);
  return this.save();
};

// Add badge
userSchema.methods.addBadge = function (badgeData) {
  const existingBadge = this.badges.find(
    (badge) => badge.name === badgeData.name
  );
  if (!existingBadge) {
    this.badges.push(badgeData);
    return this.save();
  }
  return Promise.resolve(this);
};

// Get public profile (exclude sensitive data)
userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    avatar: this.avatar,
    badges: this.badges,
    stats: {
      totalMoviesWatched: this.stats.totalMoviesWatched,
      totalReviews: this.stats.totalReviews,
      favoriteGenres: this.stats.favoriteGenres,
      joinedAt: this.stats.joinedAt,
    },
    createdAt: this.createdAt,
  };
};

// Profile management methods
userSchema.methods.createProfile = function (profileData) {
  const {
    name,
    avatar,
    profilePicture,
    isKidsProfile,
    ageRating,
    preferences,
    pin,
  } = profileData;

  // Check if user can create more profiles (premium feature)
  if (this.subscription.plan === "free" && this.profiles.length >= 1) {
    throw new Error("Premium subscription required for multiple profiles");
  }

  // Maximum 5 profiles per account
  if (this.profiles.length >= 5) {
    throw new Error("Maximum 5 profiles allowed per account");
  }

  // Check for duplicate profile names
  if (
    this.profiles.some(
      (profile) => profile.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    throw new Error("Profile name already exists");
  }

  const newProfile = {
    name,
    avatar: avatar || "",
    profilePicture: profilePicture || "",
    isKidsProfile: isKidsProfile || false,
    ageRating: ageRating || (isKidsProfile ? "PG" : "all"),
    preferences: preferences || {},
    isPrimary: this.profiles.length === 0, // First profile is primary
    pin: pin || null,
    isProtected: !!pin,
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };

  this.profiles.push(newProfile);
  return this.save();
};

userSchema.methods.updateProfile = function (profileId, updates) {
  const profile = this.profiles.id(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  // Don't allow changing profile name to existing name
  if (updates.name && updates.name !== profile.name) {
    if (
      this.profiles.some(
        (p) =>
          p._id.toString() !== profileId &&
          p.name.toLowerCase() === updates.name.toLowerCase()
      )
    ) {
      throw new Error("Profile name already exists");
    }
  }

  Object.assign(profile, updates);
  profile.lastUsedAt = new Date();

  return this.save();
};

userSchema.methods.deleteProfile = function (profileId) {
  const profile = this.profiles.id(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  if (profile.isPrimary) {
    throw new Error("Cannot delete primary profile");
  }

  if (this.profiles.length <= 1) {
    throw new Error("Cannot delete the last profile");
  }

  profile.remove();
  return this.save();
};

userSchema.methods.getProfile = function (profileId) {
  return this.profiles.id(profileId);
};

userSchema.methods.getPrimaryProfile = function () {
  return this.profiles.find((profile) => profile.isPrimary) || this.profiles[0];
};

userSchema.methods.switchProfile = function (profileId) {
  const profile = this.profiles.id(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  if (!profile.isActive) {
    throw new Error("Profile is inactive");
  }

  profile.lastUsedAt = new Date();
  return this.save();
};

userSchema.methods.validateProfilePin = function (profileId, pin) {
  const profile = this.profiles.id(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  if (!profile.isProtected) {
    return true;
  }

  return profile.pin === pin;
};

userSchema.methods.addToProfileWatchHistory = function (profileId, movieData) {
  const profile = this.profiles.id(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  // Remove existing entry if it exists
  profile.watchHistory = profile.watchHistory.filter(
    (item) => item.movieId !== movieData.movieId
  );

  // Add new entry
  profile.watchHistory.unshift({
    movieId: movieData.movieId,
    title: movieData.title,
    posterPath: movieData.posterPath,
    watchedAt: new Date(),
    watchDuration: movieData.watchDuration || 0,
    totalDuration: movieData.totalDuration || 0,
    completed: movieData.completed || false,
  });

  // Keep only last 100 items
  if (profile.watchHistory.length > 100) {
    profile.watchHistory = profile.watchHistory.slice(0, 100);
  }

  profile.lastUsedAt = new Date();
  return this.save();
};

userSchema.methods.addProfileRecommendation = function (
  profileId,
  recommendationData
) {
  const profile = this.profiles.id(profileId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  // Remove existing recommendation if it exists
  profile.recommendations = profile.recommendations.filter(
    (item) => item.movieId !== recommendationData.movieId
  );

  // Add new recommendation
  profile.recommendations.unshift({
    movieId: recommendationData.movieId,
    title: recommendationData.title,
    posterPath: recommendationData.posterPath,
    reason: recommendationData.reason,
    score: recommendationData.score || 0.5,
    generatedAt: new Date(),
    viewed: false,
  });

  // Keep only last 50 recommendations
  if (profile.recommendations.length > 50) {
    profile.recommendations = profile.recommendations.slice(0, 50);
  }

  return this.save();
};

userSchema.methods.getProfilesForUser = function () {
  return this.profiles.map((profile) => ({
    _id: profile._id,
    name: profile.name,
    avatar: profile.avatar,
    profilePicture: profile.profilePicture,
    isKidsProfile: profile.isKidsProfile,
    ageRating: profile.ageRating,
    isPrimary: profile.isPrimary,
    isActive: profile.isActive,
    isProtected: profile.isProtected,
    lastUsedAt: profile.lastUsedAt,
    createdAt: profile.createdAt,
  }));
};

module.exports = mongoose.model("User", userSchema);
