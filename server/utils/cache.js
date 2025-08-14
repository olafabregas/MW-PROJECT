const NodeCache = require("node-cache");

// Different cache instances for different types of data
const movieCache = new NodeCache({
  stdTTL: 60 * 60, // 1 hour
  checkperiod: 60 * 10, // 10 minutes
  maxKeys: 1000,
});

const userCache = new NodeCache({
  stdTTL: 60 * 15, // 15 minutes
  checkperiod: 60 * 5, // 5 minutes
  maxKeys: 500,
});

const apiCache = new NodeCache({
  stdTTL: 60 * 30, // 30 minutes
  checkperiod: 60 * 10, // 10 minutes
  maxKeys: 200,
});

class CacheManager {
  // Generic cache methods
  static set(cache, key, value, ttl = null) {
    try {
      return ttl ? cache.set(key, value, ttl) : cache.set(key, value);
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  static get(cache, key) {
    try {
      return cache.get(key);
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  static del(cache, key) {
    try {
      return cache.del(key);
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  static flush(cache) {
    try {
      return cache.flushAll();
    } catch (error) {
      console.error("Cache flush error:", error);
      return false;
    }
  }

  // Movie-specific cache methods
  static setMovie(movieId, data, ttl = 3600) {
    return this.set(movieCache, `movie:${movieId}`, data, ttl);
  }

  static getMovie(movieId) {
    return this.get(movieCache, `movie:${movieId}`);
  }

  static delMovie(movieId) {
    return this.del(movieCache, `movie:${movieId}`);
  }

  static setMovieList(listType, data, page = 1, ttl = 1800) {
    const key = `movies:${listType}:page:${page}`;
    return this.set(movieCache, key, data, ttl);
  }

  static getMovieList(listType, page = 1) {
    const key = `movies:${listType}:page:${page}`;
    return this.get(movieCache, key);
  }

  // User-specific cache methods
  static setUser(userId, data, ttl = 900) {
    return this.set(userCache, `user:${userId}`, data, ttl);
  }

  static getUser(userId) {
    return this.get(userCache, `user:${userId}`);
  }

  static delUser(userId) {
    return this.del(userCache, `user:${userId}`);
  }

  static setUserList(userId, listType, data, ttl = 600) {
    const key = `user:${userId}:${listType}`;
    return this.set(userCache, key, data, ttl);
  }

  static getUserList(userId, listType) {
    const key = `user:${userId}:${listType}`;
    return this.get(userCache, key);
  }

  static delUserList(userId, listType) {
    const key = `user:${userId}:${listType}`;
    return this.del(userCache, key);
  }

  // API response cache methods
  static setApiResponse(endpoint, params, data, ttl = 1800) {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return this.set(apiCache, key, data, ttl);
  }

  static getApiResponse(endpoint, params) {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return this.get(apiCache, key);
  }

  // Cache invalidation methods
  static invalidateUserCache(userId) {
    const userKeys = userCache
      .keys()
      .filter((key) => key.startsWith(`user:${userId}`));
    userKeys.forEach((key) => this.del(userCache, key));
  }

  static invalidateMovieCache(movieId) {
    this.delMovie(movieId);
    // Also invalidate related lists that might contain this movie
    const movieListKeys = movieCache
      .keys()
      .filter((key) => key.startsWith("movies:"));
    movieListKeys.forEach((key) => this.del(movieCache, key));
  }

  // Cache statistics
  static getStats() {
    return {
      movieCache: movieCache.getStats(),
      userCache: userCache.getStats(),
      apiCache: apiCache.getStats(),
    };
  }
}

// Middleware for caching API responses
const cacheMiddleware = (cacheName, ttl = 1800) => {
  return (req, res, next) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = CacheManager.get(
      cacheName === "movie"
        ? movieCache
        : cacheName === "user"
        ? userCache
        : apiCache,
      key
    );

    if (cached) {
      return res.json(cached);
    }

    // Store original res.json
    const originalJson = res.json;

    // Override res.json to cache the response
    res.json = function (body) {
      if (res.statusCode === 200 && body.success) {
        CacheManager.set(
          cacheName === "movie"
            ? movieCache
            : cacheName === "user"
            ? userCache
            : apiCache,
          key,
          body,
          ttl
        );
      }

      // Call original res.json
      return originalJson.call(this, body);
    };

    next();
  };
};

module.exports = {
  CacheManager,
  cacheMiddleware,
  movieCache,
  userCache,
  apiCache,
};
