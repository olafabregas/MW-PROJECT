import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tmdbService, type Movie } from "../services/tmdbService";
import "./MoviesPage.css";

// Utility function to validate movie data
const isValidMovie = (movie: Movie): boolean => {
  return !!(
    movie.id &&
    movie.title &&
    movie.title.trim() !== "" &&
    movie.poster_path &&
    movie.vote_average !== undefined &&
    movie.vote_average > 0 &&
    movie.overview &&
    movie.overview.trim() !== ""
  );
};

const MoviesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filteredMovies, setFilteredMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popularity.desc");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  const genres = [
    { id: "all", name: "All Genres" },
    { id: "28", name: "Action" },
    { id: "12", name: "Adventure" },
    { id: "16", name: "Animation" },
    { id: "35", name: "Comedy" },
    { id: "80", name: "Crime" },
    { id: "99", name: "Documentary" },
    { id: "18", name: "Drama" },
    { id: "10751", name: "Family" },
    { id: "14", name: "Fantasy" },
    { id: "36", name: "History" },
    { id: "27", name: "Horror" },
    { id: "10402", name: "Music" },
    { id: "9648", name: "Mystery" },
    { id: "10749", name: "Romance" },
    { id: "878", name: "Sci-Fi" },
    { id: "53", name: "Thriller" },
    { id: "10752", name: "War" },
    { id: "37", name: "Western" },
  ];

  const sortOptions = [
    { value: "popularity.desc", label: "Most Popular" },
    { value: "vote_average.desc", label: "Highest Rated" },
    { value: "release_date.desc", label: "Latest Release" },
    { value: "title.asc", label: "A-Z" },
  ];

  // Handle URL search params for filter presets
  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter) {
      switch (filter) {
        case "trending":
          setSortBy("popularity.desc");
          break;
        case "popular":
          setSortBy("popularity.desc");
          break;
        case "top-rated":
          setSortBy("vote_average.desc");
          break;
        default:
          break;
      }
    }
  }, [searchParams]);

  const fetchMovies = async (
    page = 1,
    genre = "all",
    sort = "popularity.desc",
    year = "all"
  ) => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page,
        sort_by: sort,
      };

      if (genre !== "all") {
        params.with_genres = genre;
      }

      if (year !== "all") {
        params.primary_release_year = parseInt(year);
      }

      const response = await tmdbService.discoverMovies(params);
      setFilteredMovies(response.results.filter(isValidMovie));
      setTotalPages(Math.min(response.total_pages, 500)); // TMDB limits to 500 pages
      setError(null);
    } catch (err) {
      setError("Failed to fetch movies. Please try again.");
      console.error("Error fetching movies:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchMovies = useCallback(
    async (query: string, page = 1) => {
      if (!query.trim()) {
        setIsSearchMode(false);
        fetchMovies(page, selectedGenre, sortBy, yearFilter);
        return;
      }

      try {
        setLoading(true);
        setIsSearchMode(true);
        const response = await tmdbService.searchMovies(query, page);
        setFilteredMovies(response.results);
        setTotalPages(Math.min(response.total_pages, 500));
        setError(null);
      } catch (err) {
        setError("Failed to search movies. Please try again.");
        console.error("Error searching movies:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedGenre, sortBy, yearFilter]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    searchMovies(searchQuery, 1);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setCurrentPage(1);
    fetchMovies(1, selectedGenre, sortBy, yearFilter);
  };

  useEffect(() => {
    if (isSearchMode && searchQuery) {
      searchMovies(searchQuery, currentPage);
    } else if (!isSearchMode) {
      fetchMovies(currentPage, selectedGenre, sortBy, yearFilter);
    }
  }, [
    currentPage,
    selectedGenre,
    sortBy,
    yearFilter,
    isSearchMode,
    searchQuery,
    searchMovies,
  ]);

  const handleMovieClick = (movieId: number) => {
    navigate(`/movie/${movieId}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderMovieCard = (movie: Movie) => (
    <div
      key={movie.id}
      className="movie-card"
      onClick={() => handleMovieClick(movie.id)}
    >
      <div className="movie-poster">
        <img
          src={tmdbService.getImageUrl(movie.poster_path, "poster", "medium")}
          alt={movie.title}
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/api/placeholder/250/375";
          }}
        />
        <div className="movie-overlay">
          <div className="movie-rating">
            ⭐ {(movie.vote_average / 2).toFixed(1)}
          </div>
          <button className="play-button">▶</button>
        </div>
      </div>
      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <p className="movie-year">
          {new Date(movie.release_date).getFullYear()}
        </p>
      </div>
    </div>
  );

  const renderPagination = () => {
    const pages = [];
    const maxPagesToShow = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="pagination-btn"
        >
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="start-ellipsis" className="pagination-ellipsis">
            ...
          </span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-btn ${i === currentPage ? "active" : ""}`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="pagination-ellipsis">
            ...
          </span>
        );
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="pagination-btn"
        >
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  if (error) {
    return (
      <div className="movies-page">
        <div className="error-container">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => fetchMovies()} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="movies-page">
      {/* Hero Section */}
      <section className="movies-hero">
        <div className="hero-content">
          <h1 className="hero-title">Discover Movies</h1>
          <p className="hero-subtitle">
            Explore thousands of movies from every genre and era
          </p>
        </div>
      </section>

      {/* Filters Section */}
      <section className="filters-section">
        <div className="filters-container">
          {/* Search Input */}
          <div className="filter-group search-group">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input-movies"
              />
              <button type="submit" className="search-btn">
                🔍
              </button>
              {isSearchMode && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="clear-search-btn"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </form>
          </div>

          <div className="filter-group">
            <label htmlFor="genre-select">Genre:</label>
            <select
              id="genre-select"
              value={selectedGenre}
              onChange={(e) => {
                setSelectedGenre(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
              disabled={isSearchMode}
            >
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-select">Sort By:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
              disabled={isSearchMode}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="year-select">Year:</label>
            <select
              id="year-select"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
              disabled={isSearchMode}
            >
              <option value="all">All Years</option>
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </section>

      {/* Movies Grid */}
      <section className="movies-grid-section">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading movies...</p>
          </div>
        ) : (
          <>
            <div className="movies-grid">
              {filteredMovies.map((movie) => renderMovieCard(movie))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-btn pagination-nav"
                >
                  ← Previous
                </button>

                <div className="pagination-numbers">{renderPagination()}</div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-btn pagination-nav"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default MoviesPage;
