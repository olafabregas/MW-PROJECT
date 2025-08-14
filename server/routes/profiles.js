const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const { validation } = require("../middleware/validation");
const logger = require("../utils/logger");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// Rate limiting for profile operations
const profileRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { error: "Too many profile requests, try again later" },
});

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../uploads/profile-pictures");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `profile-${req.user.userId}-${uniqueSuffix}${path.extname(
        file.originalname
      )}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Validation schemas
const createProfileSchema = {
  name: {
    isLength: {
      options: { min: 1, max: 30 },
      errorMessage: "Profile name must be between 1 and 30 characters",
    },
    trim: true,
  },
  isKidsProfile: {
    optional: true,
    isBoolean: {
      errorMessage: "isKidsProfile must be a boolean",
    },
  },
  ageRating: {
    optional: true,
    isIn: {
      options: [["G", "PG", "PG-13", "R", "NC-17", "all"]],
      errorMessage: "Invalid age rating",
    },
  },
  avatar: {
    optional: true,
    isLength: {
      options: { max: 255 },
      errorMessage: "Avatar URL too long",
    },
  },
  pin: {
    optional: true,
    isLength: {
      options: { min: 4, max: 6 },
      errorMessage: "PIN must be between 4 and 6 characters",
    },
  },
};

const updateProfileSchema = {
  name: {
    optional: true,
    isLength: {
      options: { min: 1, max: 30 },
      errorMessage: "Profile name must be between 1 and 30 characters",
    },
    trim: true,
  },
  avatar: {
    optional: true,
    isLength: {
      options: { max: 255 },
      errorMessage: "Avatar URL too long",
    },
  },
  isKidsProfile: {
    optional: true,
    isBoolean: {
      errorMessage: "isKidsProfile must be a boolean",
    },
  },
  ageRating: {
    optional: true,
    isIn: {
      options: [["G", "PG", "PG-13", "R", "NC-17", "all"]],
      errorMessage: "Invalid age rating",
    },
  },
  pin: {
    optional: true,
    isLength: {
      options: { min: 4, max: 6 },
      errorMessage: "PIN must be between 4 and 6 characters",
    },
  },
  isActive: {
    optional: true,
    isBoolean: {
      errorMessage: "isActive must be a boolean",
    },
  },
};

// Get all profiles for current user
router.get("/", [auth, profileRateLimit], async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profiles = user.getProfilesForUser();

    logger.info("User profiles retrieved", {
      userId: req.user.userId,
      profileCount: profiles.length,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    res.json({
      profiles,
      canCreateMore: user.subscription.plan !== "free" || profiles.length < 1,
      maxProfiles: user.subscription.plan === "free" ? 1 : 5,
    });
  } catch (error) {
    logger.error("Failed to get user profiles", {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to retrieve profiles" });
  }
});

// Get specific profile
router.get("/:profileId", [auth, profileRateLimit], async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = user.getProfile(req.params.profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    logger.info("Profile retrieved", {
      userId: req.user.userId,
      profileId: req.params.profileId,
      profileName: profile.name,
    });

    res.json({ profile });
  } catch (error) {
    logger.error("Failed to get profile", {
      userId: req.user.userId,
      profileId: req.params.profileId,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
});

// Create new profile
router.post(
  "/",
  [auth, profileRateLimit, validation(createProfileSchema)],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profileData = {
        name: req.body.name,
        avatar: req.body.avatar || "",
        isKidsProfile: req.body.isKidsProfile || false,
        ageRating:
          req.body.ageRating || (req.body.isKidsProfile ? "PG" : "all"),
        preferences: req.body.preferences || {},
        pin: req.body.pin || null,
      };

      await user.createProfile(profileData);

      const newProfile = user.profiles[user.profiles.length - 1];

      logger.info("Profile created", {
        userId: req.user.userId,
        profileId: newProfile._id,
        profileName: newProfile.name,
        isKidsProfile: newProfile.isKidsProfile,
      });

      res.status(201).json({
        message: "Profile created successfully",
        profile: {
          _id: newProfile._id,
          name: newProfile.name,
          avatar: newProfile.avatar,
          profilePicture: newProfile.profilePicture,
          isKidsProfile: newProfile.isKidsProfile,
          ageRating: newProfile.ageRating,
          isPrimary: newProfile.isPrimary,
          isActive: newProfile.isActive,
          isProtected: newProfile.isProtected,
          createdAt: newProfile.createdAt,
        },
      });
    } catch (error) {
      logger.error("Failed to create profile", {
        userId: req.user.userId,
        error: error.message,
        profileData: req.body,
      });

      if (
        error.message.includes("Premium subscription") ||
        error.message.includes("Maximum") ||
        error.message.includes("already exists")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to create profile" });
    }
  }
);

// Update profile
router.put(
  "/:profileId",
  [auth, profileRateLimit, validation(updateProfileSchema)],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updates = {};
      const allowedUpdates = [
        "name",
        "avatar",
        "isKidsProfile",
        "ageRating",
        "pin",
        "isActive",
        "preferences",
      ];

      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      await user.updateProfile(req.params.profileId, updates);

      const updatedProfile = user.getProfile(req.params.profileId);

      logger.info("Profile updated", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        updates: Object.keys(updates),
      });

      res.json({
        message: "Profile updated successfully",
        profile: {
          _id: updatedProfile._id,
          name: updatedProfile.name,
          avatar: updatedProfile.avatar,
          profilePicture: updatedProfile.profilePicture,
          isKidsProfile: updatedProfile.isKidsProfile,
          ageRating: updatedProfile.ageRating,
          isPrimary: updatedProfile.isPrimary,
          isActive: updatedProfile.isActive,
          isProtected: updatedProfile.isProtected,
          lastUsedAt: updatedProfile.lastUsedAt,
        },
      });
    } catch (error) {
      logger.error("Failed to update profile", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });

      if (
        error.message.includes("not found") ||
        error.message.includes("already exists")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to update profile" });
    }
  }
);

// Delete profile
router.delete("/:profileId", [auth, profileRateLimit], async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profileToDelete = user.getProfile(req.params.profileId);
    if (!profileToDelete) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profileName = profileToDelete.name;

    await user.deleteProfile(req.params.profileId);

    logger.info("Profile deleted", {
      userId: req.user.userId,
      profileId: req.params.profileId,
      profileName: profileName,
    });

    res.json({ message: "Profile deleted successfully" });
  } catch (error) {
    logger.error("Failed to delete profile", {
      userId: req.user.userId,
      profileId: req.params.profileId,
      error: error.message,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("Cannot delete") ||
      error.message.includes("last profile")
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to delete profile" });
  }
});

// Switch to profile
router.post(
  "/:profileId/switch",
  [auth, profileRateLimit],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = user.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Check PIN if profile is protected
      if (profile.isProtected) {
        const pin = req.body.pin;
        if (!pin) {
          return res
            .status(400)
            .json({ error: "PIN required for protected profile" });
        }

        if (!user.validateProfilePin(req.params.profileId, pin)) {
          logger.warn("Invalid PIN attempt for protected profile", {
            userId: req.user.userId,
            profileId: req.params.profileId,
            ip: req.ip,
          });
          return res.status(401).json({ error: "Invalid PIN" });
        }
      }

      await user.switchProfile(req.params.profileId);

      logger.info("Profile switched", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        profileName: profile.name,
      });

      res.json({
        message: "Profile switched successfully",
        profile: {
          _id: profile._id,
          name: profile.name,
          avatar: profile.avatar,
          profilePicture: profile.profilePicture,
          isKidsProfile: profile.isKidsProfile,
          ageRating: profile.ageRating,
          preferences: profile.preferences,
        },
      });
    } catch (error) {
      logger.error("Failed to switch profile", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });

      if (
        error.message.includes("not found") ||
        error.message.includes("inactive")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to switch profile" });
    }
  }
);

// Upload profile picture
router.post(
  "/:profileId/picture",
  [auth, profileRateLimit, upload.single("profilePicture")],
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Profile picture file is required" });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = user.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Delete old profile picture if it exists
      if (profile.profilePicture) {
        try {
          const oldPicturePath = path.join(
            __dirname,
            "../../uploads/profile-pictures",
            path.basename(profile.profilePicture)
          );
          await fs.unlink(oldPicturePath);
        } catch (error) {
          logger.warn("Failed to delete old profile picture", {
            userId: req.user.userId,
            profileId: req.params.profileId,
            oldPicture: profile.profilePicture,
            error: error.message,
          });
        }
      }

      // Update profile with new picture
      const profilePictureUrl = `/uploads/profile-pictures/${req.file.filename}`;
      await user.updateProfile(req.params.profileId, {
        profilePicture: profilePictureUrl,
      });

      logger.info("Profile picture uploaded", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        filename: req.file.filename,
        size: req.file.size,
      });

      res.json({
        message: "Profile picture uploaded successfully",
        profilePicture: profilePictureUrl,
      });
    } catch (error) {
      logger.error("Failed to upload profile picture", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });

      // Clean up uploaded file if there was an error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error("Failed to cleanup uploaded file after error", {
            filePath: req.file.path,
            error: unlinkError.message,
          });
        }
      }

      res.status(500).json({ error: "Failed to upload profile picture" });
    }
  }
);

// Delete profile picture
router.delete(
  "/:profileId/picture",
  [auth, profileRateLimit],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = user.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (!profile.profilePicture) {
        return res.status(400).json({ error: "No profile picture to delete" });
      }

      // Delete file from filesystem
      try {
        const picturePath = path.join(
          __dirname,
          "../../uploads/profile-pictures",
          path.basename(profile.profilePicture)
        );
        await fs.unlink(picturePath);
      } catch (error) {
        logger.warn("Failed to delete profile picture file", {
          userId: req.user.userId,
          profileId: req.params.profileId,
          picturePath: profile.profilePicture,
          error: error.message,
        });
      }

      // Update profile to remove picture
      await user.updateProfile(req.params.profileId, { profilePicture: "" });

      logger.info("Profile picture deleted", {
        userId: req.user.userId,
        profileId: req.params.profileId,
      });

      res.json({ message: "Profile picture deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete profile picture", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });
      res.status(500).json({ error: "Failed to delete profile picture" });
    }
  }
);

// Get profile watch history
router.get(
  "/:profileId/history",
  [auth, profileRateLimit],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = user.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const history = profile.watchHistory.slice(skip, skip + limit);
      const total = profile.watchHistory.length;

      res.json({
        history,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error("Failed to get profile watch history", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });
      res.status(500).json({ error: "Failed to retrieve watch history" });
    }
  }
);

// Add to profile watch history
router.post(
  "/:profileId/history",
  [auth, profileRateLimit],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const {
        movieId,
        title,
        posterPath,
        watchDuration,
        totalDuration,
        completed,
      } = req.body;

      if (!movieId || !title) {
        return res
          .status(400)
          .json({ error: "movieId and title are required" });
      }

      const movieData = {
        movieId,
        title,
        posterPath: posterPath || "",
        watchDuration: watchDuration || 0,
        totalDuration: totalDuration || 0,
        completed: completed || false,
      };

      await user.addToProfileWatchHistory(req.params.profileId, movieData);

      logger.info("Movie added to profile watch history", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        movieId,
        title,
      });

      res.json({ message: "Movie added to watch history successfully" });
    } catch (error) {
      logger.error("Failed to add to profile watch history", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });

      if (error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to add to watch history" });
    }
  }
);

// Get profile recommendations
router.get(
  "/:profileId/recommendations",
  [auth, profileRateLimit],
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const profile = user.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const recommendations = profile.recommendations.slice(skip, skip + limit);
      const total = profile.recommendations.length;

      res.json({
        recommendations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error("Failed to get profile recommendations", {
        userId: req.user.userId,
        profileId: req.params.profileId,
        error: error.message,
      });
      res.status(500).json({ error: "Failed to retrieve recommendations" });
    }
  }
);

module.exports = router;
