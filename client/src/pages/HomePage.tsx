import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  usePopularMovies,
  useTopRatedMovies,
  useTrending,
} from "../hooks/useTMDB";
import { tmdbService } from "../services/tmdbService";
import type { Movie, TVShow } from "../services/tmdbService";
import "./HomePage.css";

// Utility function to validate movie data
const isValidMovie = (movie: Movie | TVShow): boolean => {
  const title = "title" in movie ? movie.title : movie.name;
  return !!(
    movie.id &&
    title &&
    title.trim() !== "" &&
    movie.poster_path &&
    movie.vote_average !== undefined &&
    movie.vote_average > 0 &&
    movie.overview &&
    movie.overview.trim() !== ""
  );
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroMovies, setHeroMovies] = useState<Movie[]>([]);

  // Use TMDB hooks for different movie categories
  const {
    movies: popularMovies,
    loading: popularLoading,
    error: popularError,
  } = usePopularMovies();
  const {
    movies: topRatedMovies,
    loading: topRatedLoading,
    error: topRatedError,
  } = useTopRatedMovies();
  const {
    items: trendingItems,
    loading: trendingLoading,
    error: trendingError,
  } = useTrending("movie", "week");

  // Get hero movies from trending
  useEffect(() => {
    const fetchHeroMovies = async () => {
      try {
        const trending = await tmdbService.getTrending("movie", "week");
        setHeroMovies(trending.results.slice(0, 5) as Movie[]);
      } catch (error) {
        console.error("Failed to fetch hero movies:", error);
        // Fallback to popular movies
        if (popularMovies.length > 0) {
          setHeroMovies(popularMovies.slice(0, 5));
        }
      }
    };

    if (popularMovies.length > 0 && heroMovies.length === 0) {
      fetchHeroMovies();
    }
  }, [popularMovies, heroMovies.length]);

  // Auto-slide for hero section
  useEffect(() => {
    if (heroMovies.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroMovies.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroMovies.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroMovies.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? heroMovies.length - 1 : prev - 1));
  };

  const renderMovieCard = (movie: Movie | TVShow, showTrending = false) => {
    const title = "title" in movie ? movie.title : movie.name;

    return (
      <div
        key={movie.id}
        className="movie-card clickable-card"
        onClick={() => {
          if ("title" in movie) {
            navigate(`/movie/${movie.id}`);
          }
        }}
      >
        <div className="movie-poster">
          <img
            src={tmdbService.getImageUrl(movie.poster_path, "poster", "medium")}
            alt={title}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/api/placeholder/250/375";
            }}
          />
          {showTrending && <div className="trending-badge">🔥 Trending</div>}
          <div className="movie-rating">
            ⭐ {(movie.vote_average / 2).toFixed(1)}
          </div>
        </div>
        <div className="movie-info">
          <h4 className="movie-title">{title}</h4>
          <div className="movie-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                if ("title" in movie) {
                  navigate(`/movie/${movie.id}`);
                }
              }}
            >
              Watch Now
            </button>
            <button className="btn btn-secondary btn-sm">+ List</button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoadingGrid = () => (
    <div className="movie-grid">
      {Array(6)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="movie-card loading">
            <div className="movie-poster skeleton"></div>
            <div className="movie-info">
              <div className="skeleton-text"></div>
              <div className="skeleton-text short"></div>
            </div>
          </div>
        ))}
    </div>
  );

  if (heroMovies.length === 0 && !popularLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading OLYMPIA...</p>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* Hero Banner */}
      <section className="hero-section">
        <div className="hero-slider">
          {heroMovies.map((slide, index) => (
            <div
              key={slide.id}
              className={`hero-slide ${index === currentSlide ? "active" : ""}`}
            >
              <div
                className="hero-background"
                style={{
                  backgroundImage: `url(${tmdbService.getImageUrl(
                    slide.backdrop_path,
                    "backdrop",
                    "large"
                  )})`,
                }}
              >
                <div className="hero-overlay">
                  <div className="container">
                    <div className="hero-content">
                      <div className="hero-text">
                        <h1 className="hero-title">{slide.title}</h1>
                        <p className="hero-description">
                          {slide.overview.length > 150
                            ? `${slide.overview.substring(0, 150)}...`
                            : slide.overview}
                        </p>
                        <div className="hero-meta">
                          <span className="hero-year">
                            {new Date(slide.release_date).getFullYear()}
                          </span>
                          <span className="hero-rating">
                            ⭐ {(slide.vote_average / 2).toFixed(1)}
                          </span>
                        </div>
                        <div className="hero-actions">
                          <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/movie/${slide.id}`)}
                          >
                            Watch Now
                          </button>
                          <button className="btn btn-secondary">
                            Add to Watchlist
                          </button>
                          <button className="btn btn-gold">Play Trailer</button>
                        </div>
                      </div>
                      <div className="hero-poster">
                        <img
                          src={tmdbService.getImageUrl(
                            slide.poster_path,
                            "poster",
                            "large"
                          )}
                          alt={slide.title}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "/api/placeholder/300/450";
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Navigation arrows */}
          <button className="hero-nav prev" onClick={prevSlide}>
            ❮
          </button>
          <button className="hero-nav next" onClick={nextSlide}>
            ❯
          </button>

          {/* Slide indicators */}
          <div className="hero-indicators">
            {heroMovies.map((_, index) => (
              <button
                key={index}
                className={`indicator ${
                  index === currentSlide ? "active" : ""
                }`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section className="quick-access section-sm">
        <div className="container">
          <div className="quick-access-grid">
            <div className="quick-card">
              <div className="quick-icon">🎥</div>
              <h3>Browse Movies</h3>
              <p>Discover thousands of movies</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/movies")}
              >
                Explore
              </button>
            </div>
            <div className="quick-card">
              <div className="quick-icon">📺</div>
              <h3>Browse TV Shows</h3>
              <p>Binge-watch your favorites</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/tv-shows")}
              >
                Explore
              </button>
            </div>
            <div className="quick-card">
              <div className="quick-icon">⭐</div>
              <h3>My Watchlist</h3>
              <p>Your saved content</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/watchlist")}
              >
                View List
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Now */}
      <section className="movie-section section">
        <div className="container">
          <div className="section-header">
            <h2>🔥 Trending Now</h2>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/movies?filter=trending")}
            >
              View All
            </button>
          </div>
          <div className="movie-carousel">
            {trendingLoading && renderLoadingGrid()}
            {trendingError && (
              <div className="error-message">
                <p>Failed to load trending content: {trendingError}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
              </div>
            )}
            {!trendingLoading && !trendingError && (
              <div className="movie-grid">
                {(trendingItems as Movie[])
                  .filter((movie) => isValidMovie(movie))
                  .slice(0, 6)
                  .map((movie) => renderMovieCard(movie, true))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Popular Movies */}
      <section className="movie-section section">
        <div className="container">
          <div className="section-header">
            <h2>🍿 Popular Movies</h2>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/movies?filter=popular")}
            >
              View All
            </button>
          </div>
          <div className="movie-carousel">
            {popularLoading && renderLoadingGrid()}
            {popularError && (
              <div className="error-message">
                <p>Failed to load popular movies: {popularError}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
              </div>
            )}
            {!popularLoading && !popularError && (
              <div className="movie-grid">
                {popularMovies
                  .filter((movie) => isValidMovie(movie))
                  .slice(0, 6)
                  .map((movie) => renderMovieCard(movie))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Top Rated */}
      <section className="movie-section section">
        <div className="container">
          <div className="section-header">
            <h2>⭐ Top Rated</h2>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/movies?filter=top-rated")}
            >
              View All
            </button>
          </div>
          <div className="movie-carousel">
            {topRatedLoading && renderLoadingGrid()}
            {topRatedError && (
              <div className="error-message">
                <p>Failed to load top rated movies: {topRatedError}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
              </div>
            )}
            {!topRatedLoading && !topRatedError && (
              <div className="movie-grid">
                {topRatedMovies
                  .filter((movie) => isValidMovie(movie))
                  .slice(0, 6)
                  .map((movie) => renderMovieCard(movie))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Spotlight Section */}
      <section className="spotlight-section section-lg">
        <div
          className="spotlight-bg"
          style={{
            backgroundImage: heroMovies[0]
              ? `url(${tmdbService.getImageUrl(
                  heroMovies[0].backdrop_path,
                  "backdrop",
                  "large"
                )})`
              : "url(/api/placeholder/1200/600)",
          }}
        >
          <div className="spotlight-overlay">
            <div className="container">
              <div className="spotlight-content">
                <h2 className="spotlight-title">Featured Movie</h2>
                {heroMovies[0] && (
                  <>
                    <h3 className="spotlight-movie">{heroMovies[0].title}</h3>
                    <p className="spotlight-description">
                      {heroMovies[0].overview.length > 200
                        ? `${heroMovies[0].overview.substring(0, 200)}...`
                        : heroMovies[0].overview}
                    </p>
                    <div className="spotlight-meta">
                      <span className="spotlight-rating">
                        ⭐ {(heroMovies[0].vote_average / 2).toFixed(1)}
                      </span>
                      <span className="spotlight-year">
                        {new Date(heroMovies[0].release_date).getFullYear()}
                      </span>
                    </div>
                  </>
                )}
                <div className="spotlight-actions">
                  <button className="btn btn-gold">Play Trailer</button>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      heroMovies[0] && navigate(`/movie/${heroMovies[0].id}`)
                    }
                  >
                    Watch Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section section">
        <div className="container">
          <div className="cta-content text-center">
            <h2>Join OLYMPIA Today</h2>
            <p>
              Start your cinematic journey with unlimited access to premium
              content
            </p>
            <div className="cta-features">
              <div className="cta-feature">
                <span className="cta-icon">📱</span>
                <span>Watch Anywhere</span>
              </div>
              <div className="cta-feature">
                <span className="cta-icon">🏆</span>
                <span>Premium Quality</span>
              </div>
              <div className="cta-feature">
                <span className="cta-icon">🚫</span>
                <span>No Ads</span>
              </div>
            </div>
            <button className="btn btn-gold btn-lg">Sign Up Now</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
