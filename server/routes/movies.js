const express = require("express");
const axios = require("axios");
const { auth, optionalAuth } = require("../middleware/auth");
const User = require("../models/User");
const Review = require("../models/Review");

const router = express.Router();

// TMDb API configuration
const TMDB_BASE_URL =
  process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Helper function to make TMDb API calls
const tmdbApi = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        ...params,
      },
    });
    return response.data;
  } catch (error) {
    console.error("TMDb API Error:", error.response?.data || error.message);
    throw new Error("Failed to fetch data from TMDb");
  }
};

// @route   GET /api/movies/trending
// @desc    Get trending movies
// @access  Public
router.get("/trending", async (req, res) => {
  try {
    const { timeWindow = "day", page = 1 } = req.query;

    const data = await tmdbApi(`/trending/movie/${timeWindow}`, { page });

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Trending movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trending movies",
    });
  }
});

// @route   GET /api/movies/popular
// @desc    Get popular movies
// @access  Public
router.get("/popular", async (req, res) => {
  try {
    const { page = 1, region } = req.query;

    const params = { page };
    if (region) params.region = region;

    const data = await tmdbApi("/movie/popular", params);

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Popular movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch popular movies",
    });
  }
});

// @route   GET /api/movies/top-rated
// @desc    Get top rated movies
// @access  Public
router.get("/top-rated", async (req, res) => {
  try {
    const { page = 1, region } = req.query;

    const params = { page };
    if (region) params.region = region;

    const data = await tmdbApi("/movie/top_rated", params);

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Top rated movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top rated movies",
    });
  }
});

// @route   GET /api/movies/upcoming
// @desc    Get upcoming movies
// @access  Public
router.get("/upcoming", async (req, res) => {
  try {
    const { page = 1, region } = req.query;

    const params = { page };
    if (region) params.region = region;

    const data = await tmdbApi("/movie/upcoming", params);

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Upcoming movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming movies",
    });
  }
});

// @route   GET /api/movies/now-playing
// @desc    Get now playing movies
// @access  Public
router.get("/now-playing", async (req, res) => {
  try {
    const { page = 1, region } = req.query;

    const params = { page };
    if (region) params.region = region;

    const data = await tmdbApi("/movie/now_playing", params);

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Now playing movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch now playing movies",
    });
  }
});

// @route   GET /api/movies/search
// @desc    Search movies
// @access  Public
router.get("/search", async (req, res) => {
  try {
    const {
      query,
      page = 1,
      include_adult = false,
      region,
      year,
      primary_release_year,
    } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const params = {
      query,
      page,
      include_adult,
    };

    if (region) params.region = region;
    if (year) params.year = year;
    if (primary_release_year)
      params.primary_release_year = primary_release_year;

    const data = await tmdbApi("/search/movie", params);

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
      query,
    });
  } catch (error) {
    console.error("Search movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search movies",
    });
  }
});

// @route   GET /api/movies/genres
// @desc    Get movie genres
// @access  Public
router.get("/genres", async (req, res) => {
  try {
    const { language = "en" } = req.query;

    const data = await tmdbApi("/genre/movie/list", { language });

    res.json({
      success: true,
      data: data.genres,
    });
  } catch (error) {
    console.error("Get genres error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch genres",
    });
  }
});

// @route   GET /api/movies/discover
// @desc    Discover movies with filters
// @access  Public
router.get("/discover", async (req, res) => {
  try {
    const {
      page = 1,
      sort_by = "popularity.desc",
      include_adult = false,
      include_video = false,
      language = "en-US",
      with_genres,
      without_genres,
      year,
      primary_release_year,
      "vote_average.gte": voteAverageGte,
      "vote_average.lte": voteAverageLte,
      "vote_count.gte": voteCountGte,
      with_cast,
      with_crew,
      with_people,
      with_companies,
      with_keywords,
      without_keywords,
      "release_date.gte": releaseDateGte,
      "release_date.lte": releaseDateLte,
      "with_runtime.gte": withRuntimeGte,
      "with_runtime.lte": withRuntimeLte,
      region,
    } = req.query;

    const params = {
      page,
      sort_by,
      include_adult,
      include_video,
      language,
    };

    // Add optional parameters
    if (with_genres) params.with_genres = with_genres;
    if (without_genres) params.without_genres = without_genres;
    if (year) params.year = year;
    if (primary_release_year)
      params.primary_release_year = primary_release_year;
    if (voteAverageGte) params["vote_average.gte"] = voteAverageGte;
    if (voteAverageLte) params["vote_average.lte"] = voteAverageLte;
    if (voteCountGte) params["vote_count.gte"] = voteCountGte;
    if (with_cast) params.with_cast = with_cast;
    if (with_crew) params.with_crew = with_crew;
    if (with_people) params.with_people = with_people;
    if (with_companies) params.with_companies = with_companies;
    if (with_keywords) params.with_keywords = with_keywords;
    if (without_keywords) params.without_keywords = without_keywords;
    if (releaseDateGte) params["release_date.gte"] = releaseDateGte;
    if (releaseDateLte) params["release_date.lte"] = releaseDateLte;
    if (withRuntimeGte) params["with_runtime.gte"] = withRuntimeGte;
    if (withRuntimeLte) params["with_runtime.lte"] = withRuntimeLte;
    if (region) params.region = region;

    const data = await tmdbApi("/discover/movie", params);

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Discover movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to discover movies",
    });
  }
});

// @route   GET /api/movies/:id
// @desc    Get movie details
// @access  Public
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { language = "en-US", append_to_response } = req.query;

    const params = { language };
    if (append_to_response) {
      params.append_to_response = append_to_response;
    } else {
      params.append_to_response =
        "videos,credits,reviews,similar,recommendations";
    }

    const movieData = await tmdbApi(`/movie/${id}`, params);

    // Get user-specific data if authenticated
    let userMovieData = null;
    if (req.userId) {
      const user = await User.findById(req.userId);
      if (user) {
        userMovieData = {
          isInWatchlist: user.isInWatchlist(parseInt(id)),
          isInFavorites: user.isInFavorites(parseInt(id)),
          watchedStatus: user.watchedMovies.find(
            (movie) => movie.movieId === parseInt(id)
          )?.status,
          userRating: user.watchedMovies.find(
            (movie) => movie.movieId === parseInt(id)
          )?.rating,
        };
      }
    }

    // Get reviews from our database
    const ourReviews = await Review.find({
      movieId: parseInt(id),
      isApproved: true,
    })
      .populate("user", "username avatar")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        ...movieData,
        userMovieData,
        ourReviews: ourReviews.map((review) => review.toSafeJSON()),
      },
    });
  } catch (error) {
    console.error("Get movie details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch movie details",
    });
  }
});

// @route   GET /api/movies/:id/videos
// @desc    Get movie videos (trailers, etc.)
// @access  Public
router.get("/:id/videos", async (req, res) => {
  try {
    const { id } = req.params;
    const { language = "en-US" } = req.query;

    const data = await tmdbApi(`/movie/${id}/videos`, { language });

    res.json({
      success: true,
      data: data.results,
    });
  } catch (error) {
    console.error("Get movie videos error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch movie videos",
    });
  }
});

// @route   GET /api/movies/:id/credits
// @desc    Get movie credits (cast and crew)
// @access  Public
router.get("/:id/credits", async (req, res) => {
  try {
    const { id } = req.params;
    const { language = "en-US" } = req.query;

    const data = await tmdbApi(`/movie/${id}/credits`, { language });

    res.json({
      success: true,
      data: {
        cast: data.cast,
        crew: data.crew,
      },
    });
  } catch (error) {
    console.error("Get movie credits error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch movie credits",
    });
  }
});

// @route   GET /api/movies/:id/similar
// @desc    Get similar movies
// @access  Public
router.get("/:id/similar", async (req, res) => {
  try {
    const { id } = req.params;
    const { language = "en-US", page = 1 } = req.query;

    const data = await tmdbApi(`/movie/${id}/similar`, { language, page });

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Get similar movies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch similar movies",
    });
  }
});

// @route   GET /api/movies/:id/recommendations
// @desc    Get movie recommendations
// @access  Public
router.get("/:id/recommendations", async (req, res) => {
  try {
    const { id } = req.params;
    const { language = "en-US", page = 1 } = req.query;

    const data = await tmdbApi(`/movie/${id}/recommendations`, {
      language,
      page,
    });

    res.json({
      success: true,
      data: data.results,
      totalPages: data.total_pages,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Get movie recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch movie recommendations",
    });
  }
});

module.exports = router;
