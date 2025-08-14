const { logger } = require("../utils/logger");
const cacheService = require("../utils/cache");

class NotificationService {
  constructor(io) {
    this.io = io;
    this.notifications = new Map(); // In-memory storage for pending notifications
  }

  // Send real-time notification to user
  async sendNotification(userId, notification) {
    try {
      const formattedNotification = {
        id: this.generateNotificationId(),
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        read: false,
        createdAt: new Date(),
        expiresAt:
          notification.expiresAt ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      // Store in cache for persistence
      await this.storeNotification(userId, formattedNotification);

      // Send via Socket.IO if user is connected
      this.io.to(`user_${userId}`).emit("notification", formattedNotification);

      // Log notification
      logger.info(`Notification sent to user ${userId}:`, {
        type: notification.type,
        title: notification.title,
      });

      return formattedNotification;
    } catch (error) {
      logger.error("Failed to send notification:", error);
      throw error;
    }
  }

  // Send notification to multiple users
  async sendBulkNotification(userIds, notification) {
    try {
      const promises = userIds.map((userId) =>
        this.sendNotification(userId, notification)
      );

      const results = await Promise.allSettled(promises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      logger.info(
        `Bulk notification sent: ${successful} successful, ${failed} failed`
      );

      return { successful, failed };
    } catch (error) {
      logger.error("Bulk notification failed:", error);
      throw error;
    }
  }

  // Send notification to all users (broadcast)
  async broadcastNotification(notification) {
    try {
      const broadcastNotification = {
        id: this.generateNotificationId(),
        type: "broadcast",
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        createdAt: new Date(),
        expiresAt:
          notification.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      // Send to all connected users
      this.io.emit("broadcast_notification", broadcastNotification);

      logger.info("Broadcast notification sent:", {
        title: notification.title,
        message: notification.message,
      });

      return broadcastNotification;
    } catch (error) {
      logger.error("Broadcast notification failed:", error);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = options;

      const notifications = await this.getStoredNotifications(userId);

      let filtered = notifications;

      if (unreadOnly) {
        filtered = notifications.filter((n) => !n.read);
      }

      // Sort by creation date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedNotifications = filtered.slice(startIndex, endIndex);

      return {
        notifications: paginatedNotifications,
        total: filtered.length,
        unreadCount: notifications.filter((n) => !n.read).length,
        page,
        limit,
        hasMore: endIndex < filtered.length,
      };
    } catch (error) {
      logger.error("Failed to get user notifications:", error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(userId, notificationId) {
    try {
      const notifications = await this.getStoredNotifications(userId);
      const notification = notifications.find((n) => n.id === notificationId);

      if (notification) {
        notification.read = true;
        notification.readAt = new Date();
        await this.updateStoredNotifications(userId, notifications);

        // Emit update to user
        this.io.to(`user_${userId}`).emit("notification_read", {
          notificationId,
          readAt: notification.readAt,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      const notifications = await this.getStoredNotifications(userId);
      const now = new Date();

      const updatedNotifications = notifications.map((notification) => ({
        ...notification,
        read: true,
        readAt: notification.readAt || now,
      }));

      await this.updateStoredNotifications(userId, updatedNotifications);

      // Emit update to user
      this.io
        .to(`user_${userId}`)
        .emit("all_notifications_read", { readAt: now });

      return updatedNotifications.length;
    } catch (error) {
      logger.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(userId, notificationId) {
    try {
      const notifications = await this.getStoredNotifications(userId);
      const filteredNotifications = notifications.filter(
        (n) => n.id !== notificationId
      );

      if (filteredNotifications.length < notifications.length) {
        await this.updateStoredNotifications(userId, filteredNotifications);

        // Emit update to user
        this.io
          .to(`user_${userId}`)
          .emit("notification_deleted", { notificationId });

        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to delete notification:", error);
      throw error;
    }
  }

  // Clear old notifications
  async clearExpiredNotifications(userId) {
    try {
      const notifications = await this.getStoredNotifications(userId);
      const now = new Date();

      const validNotifications = notifications.filter(
        (n) => !n.expiresAt || new Date(n.expiresAt) > now
      );

      if (validNotifications.length < notifications.length) {
        await this.updateStoredNotifications(userId, validNotifications);
        logger.info(
          `Cleared ${
            notifications.length - validNotifications.length
          } expired notifications for user ${userId}`
        );
      }

      return validNotifications.length;
    } catch (error) {
      logger.error("Failed to clear expired notifications:", error);
      throw error;
    }
  }

  // Notification templates for different events
  getReviewLikedNotification(reviewData) {
    return {
      type: "review_liked",
      title: "Review Liked!",
      message: `Someone liked your review of "${reviewData.movieTitle}"`,
      data: {
        reviewId: reviewData.reviewId,
        movieId: reviewData.movieId,
        movieTitle: reviewData.movieTitle,
      },
    };
  }

  getReviewCommentNotification(commentData) {
    return {
      type: "review_comment",
      title: "New Comment",
      message: `${commentData.commenterName} commented on your review of "${commentData.movieTitle}"`,
      data: {
        reviewId: commentData.reviewId,
        commentId: commentData.commentId,
        movieId: commentData.movieId,
        movieTitle: commentData.movieTitle,
        commenterName: commentData.commenterName,
      },
    };
  }

  getFollowNotification(followerData) {
    return {
      type: "new_follower",
      title: "New Follower!",
      message: `${followerData.followerName} started following you`,
      data: {
        followerId: followerData.followerId,
        followerName: followerData.followerName,
        followerAvatar: followerData.followerAvatar,
      },
    };
  }

  getMovieRecommendationNotification(movieData) {
    return {
      type: "movie_recommendation",
      title: "Movie Recommendation",
      message: `Based on your preferences, you might like "${movieData.title}"`,
      data: {
        movieId: movieData.movieId,
        title: movieData.title,
        poster: movieData.poster,
        reason: movieData.reason,
      },
    };
  }

  getWatchlistUpdateNotification(movieData) {
    return {
      type: "watchlist_update",
      title: "Watchlist Update",
      message: `"${movieData.title}" from your watchlist is now available`,
      data: {
        movieId: movieData.movieId,
        title: movieData.title,
        poster: movieData.poster,
        availability: movieData.availability,
      },
    };
  }

  getAchievementNotification(achievementData) {
    return {
      type: "achievement",
      title: "Achievement Unlocked!",
      message: `You've earned the "${achievementData.name}" badge`,
      data: {
        achievementId: achievementData.id,
        name: achievementData.name,
        description: achievementData.description,
        badge: achievementData.badge,
        points: achievementData.points,
      },
    };
  }

  getSystemNotification(message, priority = "normal") {
    return {
      type: "system",
      title: "System Notification",
      message,
      data: { priority },
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    };
  }

  getMaintenanceNotification(maintenanceData) {
    return {
      type: "maintenance",
      title: "Scheduled Maintenance",
      message: `Olympia will be down for maintenance from ${maintenanceData.startTime} to ${maintenanceData.endTime}`,
      data: {
        startTime: maintenanceData.startTime,
        endTime: maintenanceData.endTime,
        description: maintenanceData.description,
      },
      expiresAt: new Date(maintenanceData.endTime),
    };
  }

  // Storage methods
  async storeNotification(userId, notification) {
    const cacheKey = `notifications:${userId}`;
    const notifications = await this.getStoredNotifications(userId);
    notifications.push(notification);

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(0, notifications.length - 100);
    }

    await cacheService.set(
      cacheKey,
      JSON.stringify(notifications),
      7 * 24 * 60 * 60
    ); // 7 days
  }

  async getStoredNotifications(userId) {
    const cacheKey = `notifications:${userId}`;
    const cached = await cacheService.get(cacheKey);
    return cached ? JSON.parse(cached) : [];
  }

  async updateStoredNotifications(userId, notifications) {
    const cacheKey = `notifications:${userId}`;
    await cacheService.set(
      cacheKey,
      JSON.stringify(notifications),
      7 * 24 * 60 * 60
    ); // 7 days
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup method
  async cleanupExpiredNotifications() {
    try {
      // This would need to iterate through all user notification caches
      // For now, it's a placeholder for the cleanup logic
      logger.info("Running notification cleanup...");

      // In a real implementation, you'd get all user IDs and clean their notifications
      // This could be run as a scheduled task

      logger.info("Notification cleanup completed");
    } catch (error) {
      logger.error("Notification cleanup failed:", error);
    }
  }
}

module.exports = NotificationService;
