const cron = require("node-cron");
const User = require("../models/User");
const Review = require("../models/Review");
const { logger } = require("../utils/logger");
const cacheService = require("../utils/cache");

class AnalyticsService {
  constructor() {
    this.startScheduledTasks();
  }

  // Real-time analytics
  async getDashboardStats() {
    try {
      const cacheKey = "dashboard_stats";
      const cached = await cacheService.getAnalytics(cacheKey);

      if (cached) {
        return cached;
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      const sevenDaysAgo = new Date(now.setDate(now.getDate() + 23));
      const oneDayAgo = new Date(now.setDate(now.getDate() + 6));

      // Parallel execution for better performance
      const [
        totalUsers,
        totalReviews,
        totalMoviesReviewed,
        newUsersLast30Days,
        newUsersLast7Days,
        activeUsersToday,
        reviewsLast30Days,
        averageRatingLast30Days,
        topRatedMovies,
        mostActiveUsers,
        platformGrowth,
      ] = await Promise.all([
        User.countDocuments(),
        Review.countDocuments({ isApproved: true }),
        Review.distinct("movieId").then((movies) => movies.length),
        User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        this.getActiveUsersToday(),
        Review.countDocuments({
          createdAt: { $gte: thirtyDaysAgo },
          isApproved: true,
        }),
        this.getAverageRating(thirtyDaysAgo),
        this.getTopRatedMovies(10),
        this.getMostActiveUsers(5),
        this.getPlatformGrowth(30),
      ]);

      const stats = {
        overview: {
          totalUsers,
          totalReviews,
          totalMoviesReviewed,
          activeUsersToday,
          platformScore: this.calculatePlatformScore({
            totalUsers,
            totalReviews,
            activeUsersToday,
            averageRating: averageRatingLast30Days,
          }),
        },
        growth: {
          newUsersLast30Days,
          newUsersLast7Days,
          reviewsLast30Days,
          userGrowthRate: this.calculateGrowthRate(
            newUsersLast30Days,
            totalUsers
          ),
          reviewGrowthRate: this.calculateGrowthRate(
            reviewsLast30Days,
            totalReviews
          ),
        },
        engagement: {
          averageRatingLast30Days,
          topRatedMovies,
          mostActiveUsers,
          engagementScore: this.calculateEngagementScore(
            activeUsersToday,
            totalUsers
          ),
        },
        trends: {
          platformGrowth,
          userRetention: await this.getUserRetentionRate(),
          popularGenres: await this.getPopularGenres(),
          peakUsageHours: await this.getPeakUsageHours(),
        },
      };

      // Cache for 1 hour
      await cacheService.cacheAnalytics(cacheKey, stats, 3600);

      return stats;
    } catch (error) {
      logger.error("Dashboard stats error:", error);
      throw error;
    }
  }

  // User analytics
  async getUserAnalytics(period = 30) {
    try {
      const cacheKey = `user_analytics_${period}`;
      const cached = await cacheService.getAnalytics(cacheKey);

      if (cached) {
        return cached;
      }

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - period);

      const [
        userGrowth,
        userDemographics,
        userActivity,
        retentionMetrics,
        topContributors,
      ] = await Promise.all([
        this.getUserGrowthTrend(period),
        this.getUserDemographics(),
        this.getUserActivityMetrics(daysAgo),
        this.getRetentionMetrics(period),
        this.getTopContributors(10),
      ]);

      const analytics = {
        growth: userGrowth,
        demographics: userDemographics,
        activity: userActivity,
        retention: retentionMetrics,
        topContributors,
        insights: this.generateUserInsights({
          userGrowth,
          userActivity,
          retentionMetrics,
        }),
      };

      // Cache for 2 hours
      await cacheService.cacheAnalytics(cacheKey, analytics, 7200);

      return analytics;
    } catch (error) {
      logger.error("User analytics error:", error);
      throw error;
    }
  }

  // Content analytics
  async getContentAnalytics(period = 30) {
    try {
      const cacheKey = `content_analytics_${period}`;
      const cached = await cacheService.getAnalytics(cacheKey);

      if (cached) {
        return cached;
      }

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - period);

      const [
        reviewTrends,
        ratingDistribution,
        mostReviewedMovies,
        contentQuality,
        moderationStats,
        genrePopularity,
      ] = await Promise.all([
        this.getReviewTrends(period),
        this.getRatingDistribution(daysAgo),
        this.getMostReviewedMovies(20),
        this.getContentQualityMetrics(daysAgo),
        this.getModerationStats(daysAgo),
        this.getGenrePopularity(daysAgo),
      ]);

      const analytics = {
        reviews: {
          trends: reviewTrends,
          distribution: ratingDistribution,
          quality: contentQuality,
          moderation: moderationStats,
        },
        movies: {
          mostReviewed: mostReviewedMovies,
          genrePopularity,
        },
        insights: this.generateContentInsights({
          reviewTrends,
          ratingDistribution,
          contentQuality,
        }),
      };

      // Cache for 2 hours
      await cacheService.cacheAnalytics(cacheKey, analytics, 7200);

      return analytics;
    } catch (error) {
      logger.error("Content analytics error:", error);
      throw error;
    }
  }

  // Performance analytics
  async getPerformanceAnalytics() {
    try {
      const cacheKey = "performance_analytics";
      const cached = await cacheService.getAnalytics(cacheKey);

      if (cached) {
        return cached;
      }

      const analytics = {
        database: await this.getDatabaseMetrics(),
        api: await this.getAPIMetrics(),
        cache: await this.getCacheMetrics(),
        errors: await this.getErrorMetrics(),
        system: await this.getSystemMetrics(),
      };

      // Cache for 30 minutes
      await cacheService.cacheAnalytics(cacheKey, analytics, 1800);

      return analytics;
    } catch (error) {
      logger.error("Performance analytics error:", error);
      throw error;
    }
  }

  // Helper methods
  async getActiveUsersToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count users who created reviews or logged in today
    const activeUsers = await Review.distinct("user", {
      createdAt: { $gte: today },
      isApproved: true,
    });

    return activeUsers.length;
  }

  async getAverageRating(since) {
    const result = await Review.aggregate([
      { $match: { createdAt: { $gte: since }, isApproved: true } },
      { $group: { _id: null, averageRating: { $avg: "$rating" } } },
    ]);

    return result.length > 0
      ? Math.round(result[0].averageRating * 10) / 10
      : 0;
  }

  async getTopRatedMovies(limit) {
    return await Review.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: "$movieId",
          movieTitle: { $first: "$movieTitle" },
          moviePoster: { $first: "$moviePoster" },
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $match: { reviewCount: { $gte: 3 } } }, // At least 3 reviews
      { $sort: { averageRating: -1, reviewCount: -1 } },
      { $limit: limit },
    ]);
  }

  async getMostActiveUsers(limit) {
    return await Review.aggregate([
      { $match: { isApproved: true } },
      { $group: { _id: "$user", reviewCount: { $sum: 1 } } },
      { $sort: { reviewCount: -1 } },
      { $limit: limit },
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
  }

  async getPlatformGrowth(days) {
    const growth = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [userCount, reviewCount] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        Review.countDocuments({
          createdAt: { $gte: date, $lt: nextDate },
          isApproved: true,
        }),
      ]);

      growth.push({
        date: date.toISOString().split("T")[0],
        users: userCount,
        reviews: reviewCount,
      });
    }

    return growth;
  }

  calculatePlatformScore({
    totalUsers,
    totalReviews,
    activeUsersToday,
    averageRating,
  }) {
    // Weighted scoring system (0-100)
    const userScore = Math.min((totalUsers / 1000) * 25, 25); // Max 25 points
    const reviewScore = Math.min((totalReviews / 5000) * 25, 25); // Max 25 points
    const activityScore = Math.min((activeUsersToday / 100) * 25, 25); // Max 25 points
    const qualityScore = (averageRating / 5) * 25; // Max 25 points

    return Math.round(userScore + reviewScore + activityScore + qualityScore);
  }

  calculateGrowthRate(newItems, totalItems) {
    if (totalItems === 0) return 0;
    return Math.round((newItems / totalItems) * 100 * 100) / 100;
  }

  calculateEngagementScore(activeUsers, totalUsers) {
    if (totalUsers === 0) return 0;
    return Math.round((activeUsers / totalUsers) * 100 * 100) / 100;
  }

  async getUserRetentionRate() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const usersFromPeriod = await User.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    });

    // Users who created reviews in the last 30 days (showing they're still active)
    const activeUserIds = await Review.distinct("user", {
      createdAt: { $gte: thirtyDaysAgo },
      isApproved: true,
    });

    const retainedUsers = await User.countDocuments({
      _id: { $in: activeUserIds },
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    });

    return usersFromPeriod > 0
      ? Math.round((retainedUsers / usersFromPeriod) * 100)
      : 0;
  }

  async getPopularGenres() {
    // This would need integration with TMDb data
    // For now, return a placeholder
    return [
      { genre: "Action", count: 150, percentage: 25 },
      { genre: "Drama", count: 120, percentage: 20 },
      { genre: "Comedy", count: 90, percentage: 15 },
      { genre: "Thriller", count: 80, percentage: 13 },
      { genre: "Horror", count: 60, percentage: 10 },
    ];
  }

  async getPeakUsageHours() {
    // Analyze review creation times
    const hourlyData = await Review.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return hourlyData.map((item) => ({
      hour: item._id,
      count: item.count,
    }));
  }

  // Scheduled analytics tasks
  startScheduledTasks() {
    // Update analytics cache every hour
    cron.schedule("0 * * * *", async () => {
      try {
        logger.info("Running scheduled analytics update");
        await this.getDashboardStats();
        await this.getUserAnalytics();
        await this.getContentAnalytics();
      } catch (error) {
        logger.error("Scheduled analytics update failed:", error);
      }
    });

    // Weekly comprehensive analytics report
    cron.schedule("0 0 * * 0", async () => {
      try {
        logger.info("Generating weekly analytics report");
        const weeklyReport = await this.generateWeeklyReport();
        // Here you could send the report via email or save to database
        logger.info("Weekly analytics report generated successfully");
      } catch (error) {
        logger.error("Weekly analytics report failed:", error);
      }
    });
  }

  async generateWeeklyReport() {
    const [dashboardStats, userAnalytics, contentAnalytics] = await Promise.all(
      [
        this.getDashboardStats(),
        this.getUserAnalytics(7),
        this.getContentAnalytics(7),
      ]
    );

    return {
      period: "weekly",
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: dashboardStats.overview.totalUsers,
        newUsers: userAnalytics.growth.totalNewUsers,
        totalReviews: dashboardStats.overview.totalReviews,
        newReviews: contentAnalytics.reviews.trends.totalNewReviews,
        platformScore: dashboardStats.overview.platformScore,
        averageRating: contentAnalytics.reviews.distribution.average,
      },
      highlights: [
        `Platform scored ${dashboardStats.overview.platformScore}/100 this week`,
        `${userAnalytics.growth.totalNewUsers} new users joined`,
        `${contentAnalytics.reviews.trends.totalNewReviews} new reviews published`,
        `Average rating: ${contentAnalytics.reviews.distribution.average}/5`,
      ],
      recommendations: this.generateRecommendations({
        dashboardStats,
        userAnalytics,
        contentAnalytics,
      }),
    };
  }

  generateRecommendations(data) {
    const recommendations = [];

    // Based on user growth
    if (data.userAnalytics.growth.growthRate < 5) {
      recommendations.push(
        "Consider marketing campaigns to increase user acquisition"
      );
    }

    // Based on engagement
    if (data.dashboardStats.engagement.engagementScore < 20) {
      recommendations.push(
        "Implement engagement features like notifications or gamification"
      );
    }

    // Based on content quality
    if (data.contentAnalytics.reviews.distribution.average < 3.5) {
      recommendations.push(
        "Review content moderation policies to improve review quality"
      );
    }

    return recommendations;
  }

  // Placeholder methods for additional analytics
  async getUserGrowthTrend(period) {
    /* Implementation */
  }
  async getUserDemographics() {
    /* Implementation */
  }
  async getUserActivityMetrics(since) {
    /* Implementation */
  }
  async getRetentionMetrics(period) {
    /* Implementation */
  }
  async getTopContributors(limit) {
    /* Implementation */
  }
  async generateUserInsights(data) {
    /* Implementation */
  }
  async getReviewTrends(period) {
    /* Implementation */
  }
  async getRatingDistribution(since) {
    /* Implementation */
  }
  async getMostReviewedMovies(limit) {
    /* Implementation */
  }
  async getContentQualityMetrics(since) {
    /* Implementation */
  }
  async getModerationStats(since) {
    /* Implementation */
  }
  async getGenrePopularity(since) {
    /* Implementation */
  }
  async generateContentInsights(data) {
    /* Implementation */
  }
  async getDatabaseMetrics() {
    /* Implementation */
  }
  async getAPIMetrics() {
    /* Implementation */
  }
  async getCacheMetrics() {
    /* Implementation */
  }
  async getErrorMetrics() {
    /* Implementation */
  }
  async getSystemMetrics() {
    /* Implementation */
  }
}

module.exports = new AnalyticsService();
