const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { logger } = require("../utils/logger");

// Get notification service from app locals
const getNotificationService = (req) => req.app.locals.notificationService;

// Get user notifications
router.get("/", protect, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const notificationService = getNotificationService(req);
    const result = await notificationService.getUserNotifications(
      req.user._id,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unreadOnly === "true",
      }
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.patch("/:notificationId/read", protect, async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notificationService = getNotificationService(req);
    const success = await notificationService.markAsRead(
      req.user._id,
      notificationId
    );

    if (success) {
      res.json({ message: "Notification marked as read" });
    } else {
      res.status(404).json({ error: "Notification not found" });
    }
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.patch("/read-all", protect, async (req, res, next) => {
  try {
    const notificationService = getNotificationService(req);
    const count = await notificationService.markAllAsRead(req.user._id);

    res.json({
      message: `${count} notifications marked as read`,
    });
  } catch (error) {
    next(error);
  }
});

// Delete notification
router.delete("/:notificationId", protect, async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notificationService = getNotificationService(req);
    const success = await notificationService.deleteNotification(
      req.user._id,
      notificationId
    );

    if (success) {
      res.json({ message: "Notification deleted" });
    } else {
      res.status(404).json({ error: "Notification not found" });
    }
  } catch (error) {
    next(error);
  }
});

// Clear expired notifications
router.delete("/expired/clear", protect, async (req, res, next) => {
  try {
    const notificationService = getNotificationService(req);
    const count = await notificationService.clearExpiredNotifications(
      req.user._id
    );

    res.json({
      message: `${count} notifications remaining after cleanup`,
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Send notification to user
router.post("/send/:userId", protect, async (req, res, next) => {
  try {
    // Only allow admins or the user themselves to send notifications
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== req.params.userId
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { userId } = req.params;
    const { type, title, message, data, expiresAt } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        error: "Type, title, and message are required",
      });
    }

    const notificationService = getNotificationService(req);
    const notification = await notificationService.sendNotification(userId, {
      type,
      title,
      message,
      data,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    logger.info(`Notification sent to user ${userId} by ${req.user.username}`);

    res.json({
      message: "Notification sent successfully",
      notification,
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Send bulk notification
router.post("/send/bulk", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userIds, type, title, message, data, expiresAt } = req.body;

    if (!userIds || !Array.isArray(userIds) || !type || !title || !message) {
      return res.status(400).json({
        error: "UserIds array, type, title, and message are required",
      });
    }

    const notificationService = getNotificationService(req);
    const result = await notificationService.sendBulkNotification(userIds, {
      type,
      title,
      message,
      data,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    logger.info(
      `Bulk notification sent to ${userIds.length} users by admin ${req.user.username}`
    );

    res.json({
      message: "Bulk notification sent",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Send broadcast notification
router.post("/broadcast", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { title, message, data, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        error: "Title and message are required",
      });
    }

    const notificationService = getNotificationService(req);
    const notification = await notificationService.broadcastNotification({
      title,
      message,
      data,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    logger.info(
      `Broadcast notification sent by admin ${req.user.username}: ${title}`
    );

    res.json({
      message: "Broadcast notification sent",
      notification,
    });
  } catch (error) {
    next(error);
  }
});

// Notification templates for common events
router.get("/templates", protect, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const notificationService = getNotificationService(req);

  const templates = {
    reviewLiked: {
      type: "review_liked",
      title: "Review Liked!",
      message: 'Someone liked your review of "[MOVIE_TITLE]"',
      variables: ["MOVIE_TITLE"],
    },
    reviewComment: {
      type: "review_comment",
      title: "New Comment",
      message: '[COMMENTER_NAME] commented on your review of "[MOVIE_TITLE]"',
      variables: ["COMMENTER_NAME", "MOVIE_TITLE"],
    },
    newFollower: {
      type: "new_follower",
      title: "New Follower!",
      message: "[FOLLOWER_NAME] started following you",
      variables: ["FOLLOWER_NAME"],
    },
    movieRecommendation: {
      type: "movie_recommendation",
      title: "Movie Recommendation",
      message: 'Based on your preferences, you might like "[MOVIE_TITLE]"',
      variables: ["MOVIE_TITLE"],
    },
    watchlistUpdate: {
      type: "watchlist_update",
      title: "Watchlist Update",
      message: '"[MOVIE_TITLE]" from your watchlist is now available',
      variables: ["MOVIE_TITLE"],
    },
    achievement: {
      type: "achievement",
      title: "Achievement Unlocked!",
      message: 'You\'ve earned the "[ACHIEVEMENT_NAME]" badge',
      variables: ["ACHIEVEMENT_NAME"],
    },
    system: {
      type: "system",
      title: "System Notification",
      message: "[CUSTOM_MESSAGE]",
      variables: ["CUSTOM_MESSAGE"],
    },
    maintenance: {
      type: "maintenance",
      title: "Scheduled Maintenance",
      message:
        "Olympia will be down for maintenance from [START_TIME] to [END_TIME]",
      variables: ["START_TIME", "END_TIME"],
    },
  };

  res.json({ templates });
});

module.exports = router;
