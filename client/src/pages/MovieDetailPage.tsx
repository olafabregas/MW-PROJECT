import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { tmdbService } from "../services/tmdbService";
import { reviewService } from "../services/reviewService";
import { watchlistService } from "../services/watchlistService";
import type { MovieDetails, Movie } from "../services/tmdbService";
import type { UserReview } from "../services/reviewService";
import { useAuth } from "../hooks/useAuth";
import TrailerModal from "../components/TrailerModal";
import AuthModal from "../components/AuthModal";
import "./MovieDetailPage.css";

interface Cast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface Crew {
  id: number;
  name: string;
  job: string;
}

interface Review {
  id: string;
  author: string;
  author_details: {
    name: string;
    username: string;
    avatar_path: string | null;
    rating: number | null;
  };
  content: string;
  created_at: string;
  updated_at: string;
}

const MovieDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [cast, setCast] = useState<Cast[]>([]);
  const [director, setDirector] = useState<string>("");
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReviews, setUserReviews] = useState<UserReview[]>([]);
  const [currentUserReview, setCurrentUserReview] = useState<UserReview | null>(
    null
  );
  const [trailerKey, setTrailerKey] = useState<string>("");
  const [showTrailer, setShowTrailer] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "cast" | "reviews">(
    "overview"
  );
  const [userReview, setUserReview] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovieData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch movie details
        const movieData = await tmdbService.getMovieDetails(parseInt(id));
        setMovie(movieData);

        // Fetch cast and crew
        const credits = await tmdbService.getMovieCredits(parseInt(id));
        setCast(credits.cast.slice(0, 10)); // Top 10 cast members

        // Find director
        const directorCredit = credits.crew.find(
          (person: Crew) => person.job === "Director"
        );
        if (directorCredit) {
          setDirector(directorCredit.name);
        }

        // Fetch similar movies
        const similar = await tmdbService.getSimilarMovies(parseInt(id));
        setSimilarMovies(similar.results.slice(0, 8));

        // Fetch TMDB reviews
        const reviewsData = await tmdbService.getMovieReviews(parseInt(id));
        setReviews(reviewsData.results.slice(0, 5)); // Top 5 TMDB reviews

        // Fetch backend user reviews
        try {
          const backendReviews = await reviewService.getMovieReviews(
            parseInt(id),
            1,
            10
          );
          setUserReviews(backendReviews.reviews);

          // If user is authenticated, check for their existing review
          if (isAuthenticated) {
            const existingReview = await reviewService.getUserMovieReview(
              parseInt(id)
            );
            if (existingReview) {
              setCurrentUserReview(existingReview);
              setUserRating(existingReview.rating);
              setUserReview(existingReview.content);
              setReviewTitle(existingReview.title);
            }
          }
        } catch (reviewError) {
          console.warn("Failed to fetch backend reviews:", reviewError);
          // Continue without backend reviews if server is unavailable
        }

        // Find trailer from videos
        if (movieData.videos?.results) {
          const trailer = movieData.videos.results.find(
            (video) => video.type === "Trailer" && video.site === "YouTube"
          );
          if (trailer) {
            setTrailerKey(trailer.key);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load movie details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
  }, [id, isAuthenticated]);

  const handleAddToWatchlist = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!movie) return;
    try {
      await watchlistService.addToWatchlist({
        id: movie.id,
        type: "movie",
        title: movie.title,
        poster_path: movie.poster_path || "",
        release_date: movie.release_date || "",
        vote_average: movie.vote_average,
        overview: movie.overview || "",
        dateAdded: new Date().toISOString(), // still required by WatchlistItem type, but ignored by backend
      });
      alert("Added to your watchlist!");
    } catch (err) {
      alert("Failed to add to watchlist. Please try again later.");
    }
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatYear = (dateString: string): string => {
    return new Date(dateString).getFullYear().toString();
  };

  const renderStarRating = (
    rating: number,
    isInteractive: boolean = false,
    size: "small" | "medium" | "large" = "medium"
  ) => {
    const sizeClass = {
      small: "star-small",
      medium: "star-medium",
      large: "star-large",
    }[size];

    return (
      <div className={`star-rating ${sizeClass}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`star ${
              star <= (isInteractive ? hoverRating || userRating : rating)
                ? "filled"
                : ""
            }`}
            onMouseEnter={
              isInteractive ? () => setHoverRating(star) : undefined
            }
            onMouseLeave={isInteractive ? () => setHoverRating(0) : undefined}
            onClick={isInteractive ? () => setUserRating(star) : undefined}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const handleSubmitReview = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!userRating || !userReview.trim()) {
      alert("Please provide both a rating and a review");
      return;
    }

    if (!reviewTitle.trim()) {
      alert("Please provide a title for your review");
      return;
    }

    if (!movie) return;

    try {
      setSubmittingReview(true);

      const reviewData = {
        movieId: parseInt(id!),
        movieTitle: movie.title,
        moviePoster: movie.poster_path || undefined,
        rating: userRating,
        title: reviewTitle.trim(),
        content: userReview.trim(),
      };

      if (currentUserReview) {
        // Update existing review
        const updatedReview = await reviewService.updateReview(
          currentUserReview.id,
          {
            rating: userRating,
            title: reviewTitle.trim(),
            content: userReview.trim(),
          }
        );
        setCurrentUserReview(updatedReview);

        // Update in the reviews list
        setUserReviews((prev) =>
          prev.map((review) =>
            review.id === updatedReview.id ? updatedReview : review
          )
        );
      } else {
        // Create new review
        const newReview = await reviewService.createReview(reviewData);
        setCurrentUserReview(newReview);
        setUserReviews((prev) => [newReview, ...prev]);
      }

      alert(
        `Review ${currentUserReview ? "updated" : "submitted"} successfully!`
      );
    } catch (error) {
      console.error("Failed to submit review:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to submit review. Please try again.";
      alert(errorMessage);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading movie details...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error || "Movie not found"}</p>
        <button onClick={() => navigate(-1)} className="back-button">
          Go Back
        </button>
      </div>
    );
  }

  const movieRating = Math.round((movie.vote_average / 2) * 10) / 10;

  return (
    <div className="movie-detail-page">
      {/* Hero Section with Full Backdrop */}
      <div className="hero-section">
        <div className="hero-backdrop">
          <img
            src={tmdbService.getImageUrl(
              movie.backdrop_path,
              "backdrop",
              "original"
            )}
            alt={movie.title}
          />
        </div>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="movie-poster">
            <img
              src={tmdbService.getImageUrl(
                movie.poster_path,
                "poster",
                "large"
              )}
              alt={movie.title}
              onError={(e) => {
                e.currentTarget.src = "/placeholder-poster.jpg";
              }}
            />
          </div>

          <div className="movie-info">
            <h1 className="movie-title">{movie.title}</h1>

            <div className="movie-meta">
              <span className="year-chip">
                {formatYear(movie.release_date)}
              </span>
              <span className="runtime-chip">
                {formatRuntime(movie.runtime)}
              </span>
              <div className="rating-chip">
                {renderStarRating(movieRating, false, "small")}
                <span className="rating-text">{movieRating}/5</span>
              </div>
            </div>

            <div className="genre-tags">
              {movie.genres.map((genre) => (
                <span key={genre.id} className="genre-tag">
                  {genre.name}
                </span>
              ))}
            </div>

            <div className="action-buttons">
              {trailerKey && (
                <button
                  className="watch-button primary"
                  onClick={() => setShowTrailer(true)}
                >
                  <span className="button-icon">▶</span>
                  Watch Trailer
                </button>
              )}
              <button
                className="wishlist-button secondary"
                onClick={handleAddToWatchlist}
              >
                <span className="button-icon">+</span>
                Add to Watchlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Movie Stats Row */}
      <div className="stats-section">
        <div className="stats-container">
          <div className="stat-item">
            <h3>Director</h3>
            <p>{director || "Unknown"}</p>
          </div>
          <div className="stat-item">
            <h3>Rating</h3>
            <div className="rating-display">
              {renderStarRating(movieRating)}
              <span className="vote-count">
                ({movie.vote_count.toLocaleString()} votes)
              </span>
            </div>
          </div>
          <div className="stat-item">
            <h3>Release Date</h3>
            <p>{new Date(movie.release_date).toLocaleDateString()}</p>
          </div>
          <div className="stat-item">
            <h3>Runtime</h3>
            <p>{formatRuntime(movie.runtime)}</p>
          </div>
        </div>
      </div>

      {/* Tabbed Content Section */}
      <div className="tabbed-content-section">
        <div className="tab-container">
          {/* Tab Navigation */}
          <div className="tab-nav">
            <button
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`tab-btn ${activeTab === "cast" ? "active" : ""}`}
              onClick={() => setActiveTab("cast")}
            >
              Cast
            </button>
            <button
              className={`tab-btn ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              Reviews
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="overview-content">
                <div className="description-section">
                  <h2>Overview</h2>
                  <p
                    className={`description-text ${
                      showFullDescription ? "expanded" : ""
                    }`}
                  >
                    {movie.overview}
                  </p>
                  {movie.overview.length > 200 && (
                    <button
                      className="read-more-button"
                      onClick={() =>
                        setShowFullDescription(!showFullDescription)
                      }
                    >
                      {showFullDescription ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>

                <div className="movie-details">
                  <h3>Movie Details</h3>
                  <div className="details-grid">
                    <div className="detail-item">
                      <span className="label">Genres:</span>
                      <span>{movie.genres.map((g) => g.name).join(", ")}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Language:</span>
                      <span>{movie.original_language.toUpperCase()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Vote Count:</span>
                      <span>{movie.vote_count.toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Release Date:</span>
                      <span>
                        {new Date(movie.release_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cast Tab */}
            {activeTab === "cast" && (
              <div className="cast-content">
                {cast.length > 0 ? (
                  <>
                    <h2>Cast & Crew</h2>
                    <div className="cast-grid">
                      {cast.map((actor) => (
                        <div key={actor.id} className="cast-card">
                          <div className="cast-photo">
                            <img
                              src={tmdbService.getImageUrl(
                                actor.profile_path,
                                "poster",
                                "medium"
                              )}
                              alt={actor.name}
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-person.jpg";
                              }}
                            />
                          </div>
                          <div className="cast-info">
                            <h4>{actor.name}</h4>
                            <p>{actor.character}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="no-content">
                    <p>Cast information not available</p>
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <div className="reviews-content">
                <div className="user-review-section">
                  <h2>
                    {currentUserReview
                      ? "Update Your Review"
                      : "Rate & Review This Movie"}
                  </h2>
                  {!isAuthenticated ? (
                    <div className="login-prompt">
                      <p>Please log in to rate and review this movie.</p>
                      <button
                        className="login-btn"
                        onClick={() => setShowAuthModal(true)}
                      >
                        Login / Register
                      </button>
                    </div>
                  ) : (
                    <div className="user-rating-form">
                      <div className="rating-input">
                        <p>Your Rating:</p>
                        {renderStarRating(userRating, true, "large")}
                      </div>

                      <div className="review-input">
                        <label htmlFor="reviewTitle">Review Title:</label>
                        <input
                          type="text"
                          id="reviewTitle"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          placeholder="Give your review a title..."
                          maxLength={100}
                        />
                      </div>

                      <div className="review-input">
                        <label htmlFor="review">Your Review:</label>
                        <textarea
                          id="review"
                          value={userReview}
                          onChange={(e) => setUserReview(e.target.value)}
                          placeholder="Share your thoughts about this movie..."
                          rows={4}
                          maxLength={2000}
                        />
                      </div>

                      <button
                        className="submit-review-btn"
                        onClick={handleSubmitReview}
                        disabled={
                          submittingReview ||
                          !userRating ||
                          !userReview.trim() ||
                          !reviewTitle.trim()
                        }
                      >
                        {submittingReview
                          ? currentUserReview
                            ? "Updating Review..."
                            : "Submitting Review..."
                          : currentUserReview
                          ? "Update Review"
                          : "Submit Review"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Backend User Reviews */}
                {userReviews.length > 0 && (
                  <div className="user-reviews-section">
                    <h3>User Reviews ({userReviews.length})</h3>
                    <div className="reviews-list">
                      {userReviews.map((review) => (
                        <div key={review.id} className="review-card">
                          <div className="review-header">
                            <div className="reviewer-info">
                              <div className="reviewer-avatar">
                                {review.user.avatar ? (
                                  <img
                                    src={review.user.avatar}
                                    alt={review.user.username}
                                  />
                                ) : (
                                  <div className="avatar-placeholder">
                                    {review.user.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="reviewer-details">
                                <h4>{review.user.username}</h4>
                                <p className="review-date">
                                  {new Date(
                                    review.createdAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="review-rating">
                              {renderStarRating(review.rating, false, "small")}
                              <span>{review.rating}/5</span>
                            </div>
                          </div>
                          <div className="review-title">
                            <h5>{review.title}</h5>
                          </div>
                          <div className="review-content">
                            <p>
                              {review.content.length > 300
                                ? `${review.content.substring(0, 300)}...`
                                : review.content}
                            </p>
                          </div>
                          {user && user.id === review.user.id && (
                            <div className="review-actions">
                              <button
                                className="edit-review-btn"
                                onClick={() => {
                                  setUserRating(review.rating);
                                  setReviewTitle(review.title);
                                  setUserReview(review.content);
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TMDB Reviews */}
                {reviews.length > 0 && (
                  <div className="tmdb-reviews-section">
                    <h3>TMDB Reviews ({reviews.length})</h3>
                    <div className="reviews-list">
                      {reviews.map((review) => (
                        <div
                          key={review.id}
                          className="review-card tmdb-review"
                        >
                          <div className="review-header">
                            <div className="reviewer-info">
                              <div className="reviewer-avatar">
                                {review.author_details.avatar_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`}
                                    alt={review.author}
                                  />
                                ) : (
                                  <div className="avatar-placeholder">
                                    {review.author.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="reviewer-details">
                                <h4>{review.author}</h4>
                                <p className="review-date">
                                  {new Date(
                                    review.created_at
                                  ).toLocaleDateString()}
                                </p>
                                <span className="tmdb-badge">TMDB</span>
                              </div>
                            </div>
                            {review.author_details.rating && (
                              <div className="review-rating">
                                {renderStarRating(
                                  review.author_details.rating / 2,
                                  false,
                                  "small"
                                )}
                                <span>
                                  {(review.author_details.rating / 2).toFixed(
                                    1
                                  )}
                                  /5
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="review-content">
                            <p>
                              {review.content.length > 300
                                ? `${review.content.substring(0, 300)}...`
                                : review.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userReviews.length === 0 && reviews.length === 0 && (
                  <div className="no-reviews">
                    <p>No reviews yet. Be the first to review this movie!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trailer Modal */}
      <TrailerModal
        videoKey={trailerKey}
        isOpen={showTrailer}
        onClose={() => setShowTrailer(false)}
        title={`${movie.title} - Official Trailer`}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialTab="login"
      />

      {/* Similar Movies Section */}
      {similarMovies.length > 0 && (
        <div className="similar-movies-section">
          <div className="similar-container">
            <h2>Similar Movies</h2>
            <div className="similar-grid">
              {similarMovies.map((similarMovie) => (
                <div
                  key={similarMovie.id}
                  className="similar-card"
                  onClick={() => navigate(`/movie/${similarMovie.id}`)}
                >
                  <div className="similar-poster">
                    <img
                      src={tmdbService.getImageUrl(
                        similarMovie.poster_path,
                        "poster",
                        "medium"
                      )}
                      alt={similarMovie.title}
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-poster.jpg";
                      }}
                    />
                    <div className="similar-overlay">
                      <button className="quick-trailer">▶</button>
                    </div>
                  </div>
                  <div className="similar-info">
                    <h4>{similarMovie.title}</h4>
                    <div className="similar-rating">
                      {renderStarRating(
                        Math.round((similarMovie.vote_average / 2) * 10) / 10,
                        false,
                        "small"
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetailPage;
