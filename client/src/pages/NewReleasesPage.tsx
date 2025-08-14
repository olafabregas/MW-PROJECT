import React, { useState, useEffect } from "react";
import { tmdbService } from "../services/tmdbService";
import "./MoviesPage.css";

interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
  overview: string;
}

const NewReleasesPage: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchNewReleases = async () => {
      try {
        setLoading(true);
        const response = await tmdbService.discoverMovies({
          page: currentPage,
          sortBy: "primary_release_date.desc",
        });

        setMovies(response.results);
        setError(null);
      } catch (err) {
        setError("Failed to fetch new releases");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNewReleases();
  }, [currentPage]);

  const handleMovieClick = (movieId: number) => {
    window.location.href = `/movie/${movieId}`;
  };

  const nextPage = () => {
    setCurrentPage((prev) => prev + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="movies-page">
        <div className="container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading new releases...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="movies-page">
        <div className="container">
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="movies-page">
      <div className="container">
        <div className="page-header">
          <h1>New Releases</h1>
          <p className="page-description">
            Discover the latest movies from the past 6 months
          </p>
        </div>

        <div className="movies-grid">
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="movie-card clickable-card"
              onClick={() => handleMovieClick(movie.id)}
            >
              <div className="movie-poster">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                  />
                ) : (
                  <div className="no-poster">
                    <span>No Image</span>
                  </div>
                )}
                <div className="movie-overlay">
                  <span className="movie-rating">
                    ⭐ {movie.vote_average.toFixed(1)}
                  </span>
                  <div className="release-badge">
                    {new Date(movie.release_date).getFullYear()}
                  </div>
                </div>
              </div>
              <div className="movie-info">
                <h3 className="movie-title">{movie.title}</h3>
                <p className="movie-overview">
                  {movie.overview.length > 120
                    ? `${movie.overview.substring(0, 120)}...`
                    : movie.overview}
                </p>
                <div className="movie-actions">
                  <button className="btn btn-primary btn-sm">
                    View Details
                  </button>
                  <button className="btn btn-secondary btn-sm">
                    Add to List
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pagination-container">
          <button
            className="pagination-btn"
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">Page {currentPage}</span>
          <button className="pagination-btn" onClick={nextPage}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewReleasesPage;
