const axios = require("axios");
const { CacheManager } = require("./cache");

// OpenAI Integration for AI recommendations
class AIService {
  constructor() {
    this.openai = axios.create({
      baseURL: "https://api.openai.com/v1",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
  }

  async getMovieRecommendations(userProfile, query) {
    try {
      const cacheKey = `ai_recommendations:${JSON.stringify({
        userProfile,
        query,
      })}`;
      const cached = CacheManager.getApiResponse("ai", cacheKey);

      if (cached) return cached;

      const prompt = this.buildRecommendationPrompt(userProfile, query);

      const response = await this.openai.post("/chat/completions", {
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a movie recommendation expert. Provide personalized movie suggestions based on user preferences and query. Return a JSON array of movie objects with title, year, genre, and reason for recommendation.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const recommendations = this.parseAIResponse(
        response.data.choices[0].message.content
      );

      CacheManager.setApiResponse("ai", cacheKey, recommendations, 3600); // Cache for 1 hour

      return recommendations;
    } catch (error) {
      console.error("AI recommendation error:", error);
      throw new Error("Failed to get AI recommendations");
    }
  }

  buildRecommendationPrompt(userProfile, query) {
    const { favoriteGenres, recentlyWatched, ratings, watchlist } = userProfile;

    let prompt = `User preferences:
- Favorite genres: ${favoriteGenres?.join(", ") || "None specified"}
- Recently watched: ${
      recentlyWatched
        ?.slice(0, 5)
        .map((m) => m.title)
        .join(", ") || "None"
    }
- High-rated movies: ${
      ratings
        ?.filter((r) => r.rating >= 4)
        .slice(0, 3)
        .map((r) => r.title)
        .join(", ") || "None"
    }

User query: "${query}"

Please recommend 5-8 movies that match the user's preferences and query. Consider their genre preferences and viewing history.`;

    return prompt;
  }

  parseAIResponse(content) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: parse text response
      return this.parseTextResponse(content);
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return [];
    }
  }

  parseTextResponse(content) {
    // Simple text parsing as fallback
    const lines = content.split("\n").filter((line) => line.trim());
    const recommendations = [];

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        const titleMatch = line.match(/"([^"]+)"/);
        if (titleMatch) {
          recommendations.push({
            title: titleMatch[1],
            reason: line.replace(/^\d+\.\s*"[^"]+"\s*-?\s*/, ""),
          });
        }
      }
    }

    return recommendations;
  }

  async summarizeMovie(movieData) {
    try {
      const cacheKey = `ai_summary:${movieData.id}`;
      const cached = CacheManager.getApiResponse("ai", cacheKey);

      if (cached) return cached;

      const prompt = `Summarize this movie in 2-3 sentences:
Title: ${movieData.title}
Overview: ${movieData.overview}
Genre: ${movieData.genres?.map((g) => g.name).join(", ")}
Release Date: ${movieData.release_date}`;

      const response = await this.openai.post("/chat/completions", {
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a movie critic. Provide concise, engaging movie summaries.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.5,
      });

      const summary = response.data.choices[0].message.content.trim();

      CacheManager.setApiResponse("ai", cacheKey, summary, 24 * 3600); // Cache for 24 hours

      return summary;
    } catch (error) {
      console.error("AI summary error:", error);
      return movieData.overview; // Fallback to original overview
    }
  }
}

// Enhanced TMDb API client
class TMDbService {
  constructor() {
    this.baseURL = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
    this.apiKey = process.env.TMDB_API_KEY;
    this.imageBaseURL =
      process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p";

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      params: {
        api_key: this.apiKey,
      },
    });

    // Request interceptor for caching and retry logic
    this.client.interceptors.request.use(
      (config) => {
        // Add cache check
        const cacheKey = `tmdb:${config.url}:${JSON.stringify(config.params)}`;
        const cached = CacheManager.getApiResponse("movie", cacheKey);

        if (cached) {
          // Return cached response in the expected format
          return Promise.reject({
            cached: true,
            data: cached,
          });
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for caching and error handling
    this.client.interceptors.response.use(
      (response) => {
        // Cache successful responses
        const cacheKey = `tmdb:${response.config.url}:${JSON.stringify(
          response.config.params
        )}`;
        CacheManager.setApiResponse("movie", cacheKey, response.data, 1800); // 30 minutes

        return response;
      },
      (error) => {
        // Handle cached responses
        if (error.cached) {
          return Promise.resolve({ data: error.data });
        }

        // Handle API errors
        if (error.response?.status === 429) {
          throw new Error("TMDb API rate limit exceeded");
        } else if (error.response?.status >= 500) {
          throw new Error("TMDb API service unavailable");
        } else if (error.code === "ECONNABORTED") {
          throw new Error("TMDb API request timeout");
        }

        throw error;
      }
    );
  }

  async searchMovies(query, options = {}) {
    const response = await this.client.get("/search/movie", {
      params: {
        query,
        page: options.page || 1,
        include_adult: options.includeAdult || false,
        region: options.region,
        year: options.year,
        primary_release_year: options.primaryReleaseYear,
      },
    });

    return this.enhanceMovieResults(response.data);
  }

  async getMovieDetails(
    movieId,
    appendToResponse = "videos,credits,reviews,similar,recommendations"
  ) {
    const response = await this.client.get(`/movie/${movieId}`, {
      params: {
        append_to_response: appendToResponse,
      },
    });

    return this.enhanceMovieData(response.data);
  }

  async discoverMovies(filters = {}) {
    const response = await this.client.get("/discover/movie", {
      params: {
        sort_by: filters.sortBy || "popularity.desc",
        page: filters.page || 1,
        with_genres: filters.genres,
        "vote_average.gte": filters.minRating,
        "vote_average.lte": filters.maxRating,
        "release_date.gte": filters.releaseDateFrom,
        "release_date.lte": filters.releaseDateTo,
        with_cast: filters.cast,
        with_crew: filters.crew,
        region: filters.region,
      },
    });

    return this.enhanceMovieResults(response.data);
  }

  async getTrendingMovies(timeWindow = "day", page = 1) {
    const response = await this.client.get(`/trending/movie/${timeWindow}`, {
      params: { page },
    });

    return this.enhanceMovieResults(response.data);
  }

  enhanceMovieResults(data) {
    return {
      ...data,
      results: data.results.map((movie) => this.enhanceMovieData(movie)),
    };
  }

  enhanceMovieData(movie) {
    return {
      ...movie,
      // Add full image URLs
      poster_url: movie.poster_path
        ? `${this.imageBaseURL}/w500${movie.poster_path}`
        : null,
      backdrop_url: movie.backdrop_path
        ? `${this.imageBaseURL}/w1280${movie.backdrop_path}`
        : null,

      // Add additional computed fields
      year: movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : null,
      rating_percentage: movie.vote_average
        ? Math.round(movie.vote_average * 10)
        : null,

      // Format runtime
      runtime_formatted: movie.runtime
        ? this.formatRuntime(movie.runtime)
        : null,
    };
  }

  formatRuntime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  getImageURL(path, size = "w500") {
    return path ? `${this.imageBaseURL}/${size}${path}` : null;
  }
}

// Notification service
class NotificationService {
  static async sendWelcomeEmail(user) {
    // Implementation would depend on your email service (SendGrid, etc.)
    console.log(`Sending welcome email to ${user.email}`);
  }

  static async sendPasswordResetEmail(user, resetToken) {
    console.log(`Sending password reset email to ${user.email}`);
  }

  static async sendReviewNotification(review, type = "new") {
    console.log(`Sending review notification: ${type}`);
  }

  static async sendSecurityAlert(user, event) {
    console.log(`Sending security alert to ${user.email}: ${event}`);
  }
}

// Background job processor
class JobProcessor {
  static jobs = new Map();
  static interval = null;

  static addJob(id, fn, intervalMs) {
    this.jobs.set(id, { fn, intervalMs, lastRun: 0 });
    this.startProcessor();
  }

  static removeJob(id) {
    this.jobs.delete(id);
    if (this.jobs.size === 0) {
      this.stopProcessor();
    }
  }

  static startProcessor() {
    if (this.interval) return;

    this.interval = setInterval(() => {
      const now = Date.now();

      for (const [id, job] of this.jobs.entries()) {
        if (now - job.lastRun >= job.intervalMs) {
          try {
            job.fn();
            job.lastRun = now;
          } catch (error) {
            console.error(`Job ${id} failed:`, error);
          }
        }
      }
    }, 1000); // Check every second
  }

  static stopProcessor() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Initialize background jobs
JobProcessor.addJob(
  "cache-cleanup",
  () => {
    // Clean up expired cache entries
    console.log("Running cache cleanup...");
  },
  60 * 60 * 1000
); // Every hour

JobProcessor.addJob(
  "analytics-aggregation",
  () => {
    // Aggregate analytics data
    console.log("Running analytics aggregation...");
  },
  24 * 60 * 60 * 1000
); // Every day

module.exports = {
  AIService,
  TMDbService,
  NotificationService,
  JobProcessor,
};
