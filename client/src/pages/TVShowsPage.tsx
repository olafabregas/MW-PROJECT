import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { tmdbService, type TVShow } from "../services/tmdbService";
import "./TVShowsPage.css";

// Utility function to validate TV show data
const isValidTVShow = (show: TVShow): boolean => {
  return !!(
    show.id &&
    show.name &&
    show.name.trim() !== "" &&
    show.poster_path &&
    show.vote_average !== undefined &&
    show.vote_average > 0 &&
    show.overview &&
    show.overview.trim() !== ""
  );
};

const TVShowsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filteredShows, setFilteredShows] = useState<TVShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popularity.desc");
  const [status, setStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  const genres = [
    { id: "all", name: "All Genres" },
    { id: "10759", name: "Action & Adventure" },
    { id: "16", name: "Animation" },
    { id: "35", name: "Comedy" },
    { id: "80", name: "Crime" },
    { id: "99", name: "Documentary" },
    { id: "18", name: "Drama" },
    { id: "10751", name: "Family" },
    { id: "10762", name: "Kids" },
    { id: "9648", name: "Mystery" },
    { id: "10763", name: "News" },
    { id: "10764", name: "Reality" },
    { id: "10765", name: "Sci-Fi & Fantasy" },
    { id: "10766", name: "Soap" },
    { id: "10767", name: "Talk" },
    { id: "10768", name: "War & Politics" },
    { id: "37", name: "Western" },
  ];

  const sortOptions = [
    { value: "popularity.desc", label: "Most Popular" },
    { value: "vote_average.desc", label: "Highest Rated" },
    { value: "first_air_date.desc", label: "Latest Release" },
    { value: "name.asc", label: "A-Z" },
  ];

  const statusOptions = [
    { value: "all", label: "All Shows" },
    { value: "0", label: "Returning Series" },
    { value: "1", label: "Planned" },
    { value: "2", label: "In Production" },
    { value: "3", label: "Ended" },
    { value: "4", label: "Cancelled" },
    { value: "5", label: "Pilot" },
  ];

  const fetchTVShows = async (
    page = 1,
    genre = "all",
    sort = "popularity.desc",
    showStatus = "all"
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

      if (showStatus !== "all") {
        params.with_status = showStatus;
      }

      const response = await tmdbService.discoverTVShows(params);
      const validShows = response.results.filter(isValidTVShow);
      setFilteredShows(validShows);
      setTotalPages(Math.min(response.total_pages, 500));
      setError(null);
    } catch (err) {
      setError("Failed to fetch TV shows. Please try again.");
      console.error("Error fetching TV shows:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchTVShows = useCallback(
    async (query: string, page = 1) => {
      if (!query.trim()) {
        setIsSearchMode(false);
        fetchTVShows(page, selectedGenre, sortBy, status);
        return;
      }

      try {
        setLoading(true);
        setIsSearchMode(true);
        const response = await tmdbService.searchTVShows(query, page);
        const validShows = response.results.filter(isValidTVShow);
        setFilteredShows(validShows);
        setTotalPages(Math.min(response.total_pages, 500));
        setError(null);
      } catch (err) {
        setError("Failed to search TV shows. Please try again.");
        console.error("Error searching TV shows:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedGenre, sortBy, status]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    searchTVShows(searchQuery, 1);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setCurrentPage(1);
    fetchTVShows(1, selectedGenre, sortBy, status);
  };

  useEffect(() => {
    if (!isSearchMode) {
      fetchTVShows(currentPage, selectedGenre, sortBy, status);
    }
  }, [currentPage, selectedGenre, sortBy, status, isSearchMode]);

  const handleShowClick = (showId: number) => {
    navigate(`/movie/${showId}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);

    // If in search mode, continue with search, otherwise use regular fetch
    if (isSearchMode && searchQuery) {
      searchTVShows(searchQuery, page);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderShowCard = (show: TVShow) => (
    <div
      key={show.id}
      className="tv-show-card"
      onClick={() => handleShowClick(show.id)}
    >
      <div className="show-poster">
        <img
          src={tmdbService.getImageUrl(show.poster_path, "poster", "medium")}
          alt={show.name}
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/api/placeholder/250/375";
          }}
        />
        <div className="show-overlay">
          <div className="show-rating">
            ⭐ {(show.vote_average / 2).toFixed(1)}
          </div>
          <button className="play-button">▶</button>
        </div>
      </div>
      <div className="show-info">
        <h3 className="show-title">{show.name}</h3>
        <p className="show-year">
          {show.first_air_date
            ? new Date(show.first_air_date).getFullYear()
            : "TBA"}
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
      <div className="tv-shows-page">
        <div className="error-container">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => fetchTVShows()} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-shows-page">
      {/* Hero Section */}
      <section className="shows-hero">
        <div className="hero-content">
          <h1 className="hero-title">Discover TV Shows</h1>
          <p className="hero-subtitle">
            Explore the best series from around the world
          </p>
        </div>
      </section>

      {/* Filters Section */}
      <section className="filters-section">
        <div className="filters-container">
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Search TV shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-btn" disabled={loading}>
                🔍
              </button>
              {isSearchMode && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="clear-search-btn"
                  disabled={loading}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          <div className="filter-group">
            <label htmlFor="genre-select">Genre:</label>
            <select
              id="genre-select"
              value={selectedGenre}
              onChange={(e) => {
                setSelectedGenre(e.target.value);
                setCurrentPage(1);
              }}
              className={`filter-select ${isSearchMode ? "disabled" : ""}`}
              disabled={isSearchMode || loading}
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
              className={`filter-select ${isSearchMode ? "disabled" : ""}`}
              disabled={isSearchMode || loading}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="status-select">Status:</label>
            <select
              id="status-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCurrentPage(1);
              }}
              className={`filter-select ${isSearchMode ? "disabled" : ""}`}
              disabled={isSearchMode || loading}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* TV Shows Grid */}
      <section className="shows-grid-section">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading TV shows...</p>
          </div>
        ) : (
          <>
            <div className="shows-grid">
              {filteredShows.map((show) => renderShowCard(show))}
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

export default TVShowsPage;
