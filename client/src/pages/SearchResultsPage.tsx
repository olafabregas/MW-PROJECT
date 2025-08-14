import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tmdbService } from "../services/tmdbService";
import "./SearchResultsPage.css";

interface SimpleSearchResult {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
}

const SearchResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<SimpleSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");

  const performSearch = async (
    searchQuery: string,
    page = 1,
    mediaType: "all" | "movie" | "tv" = "all"
  ) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let response;

      if (mediaType === "all") {
        response = await tmdbService.multiSearch(searchQuery, page);
      } else if (mediaType === "movie") {
        response = await tmdbService.searchMovies(searchQuery, page);
      } else {
        response = await tmdbService.searchTVShows(searchQuery, page);
      }

      // Filter results to only movies and TV shows
      const resultsWithType: SimpleSearchResult[] = (
        response.results as unknown[]
      ).filter((item: unknown) => {
        const typedItem = item as { media_type?: string };
        return (
          typedItem.media_type === "movie" || typedItem.media_type === "tv"
        );
      }) as SimpleSearchResult[];

      setResults(resultsWithType);
      setTotalPages(Math.min(response.total_pages, 100)); // Limit to 100 pages
      setTotalResults(response.total_results);
    } catch (err) {
      setError("Failed to perform search. Please try again.");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      performSearch(query, currentPage, filter);
    }
  }, [query, currentPage, filter]);

  const handleItemClick = (item: SimpleSearchResult) => {
    if (item.media_type === "movie") {
      navigate(`/movie/${item.id}`);
    } else {
      navigate(`/tv-show/${item.id}`);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFilterChange = (newFilter: "all" | "movie" | "tv") => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleNewSearch = (newQuery: string) => {
    setSearchParams({ q: newQuery });
    setCurrentPage(1);
    setFilter("all");
  };

  const renderSearchResult = (item: SimpleSearchResult) => {
    const title = item.media_type === "movie" ? item.title : item.name;
    const releaseDate =
      item.media_type === "movie" ? item.release_date : item.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : "TBA";

    return (
      <div
        key={`${item.media_type}-${item.id}`}
        className="search-result-card"
        onClick={() => handleItemClick(item)}
      >
        <div className="result-poster">
          <img
            src={tmdbService.getImageUrl(item.poster_path, "poster", "small")}
            alt={title}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/api/placeholder/150/225";
            }}
          />
          <div className="result-overlay">
            <div className="media-type-badge">
              {item.media_type === "movie" ? "🎬" : "📺"}
            </div>
            <div className="result-rating">
              ⭐ {item.vote_average.toFixed(1)}
            </div>
          </div>
        </div>
        <div className="result-info">
          <h3 className="result-title">{title}</h3>
          <p className="result-year">{year}</p>
          <p className="result-type">
            {item.media_type === "movie" ? "Movie" : "TV Show"}
          </p>
          {item.overview && <p className="result-overview">{item.overview}</p>}
        </div>
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

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

  return (
    <div className="search-results-page">
      {/* Search Header */}
      <section className="search-header">
        <div className="search-header-content">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search for movies, TV shows..."
              defaultValue={query}
              className="search-input"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  const target = e.target as HTMLInputElement;
                  handleNewSearch(target.value);
                }
              }}
            />
            <button className="search-button">🔍</button>
          </div>

          {query && (
            <div className="search-info">
              <h1 className="search-title">Search Results for "{query}"</h1>
              <p className="search-subtitle">
                {totalResults > 0
                  ? `Found ${totalResults.toLocaleString()} results`
                  : "No results found"}
              </p>
            </div>
          )}
        </div>
      </section>

      {query && (
        <>
          {/* Filters */}
          <section className="search-filters">
            <div className="filters-container">
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${filter === "all" ? "active" : ""}`}
                  onClick={() => handleFilterChange("all")}
                >
                  All Results
                </button>
                <button
                  className={`filter-tab ${filter === "movie" ? "active" : ""}`}
                  onClick={() => handleFilterChange("movie")}
                >
                  Movies
                </button>
                <button
                  className={`filter-tab ${filter === "tv" ? "active" : ""}`}
                  onClick={() => handleFilterChange("tv")}
                >
                  TV Shows
                </button>
              </div>

              {results.length > 0 && (
                <div className="results-count">
                  Showing {results.length} of {totalResults.toLocaleString()}{" "}
                  results
                </div>
              )}
            </div>
          </section>

          {/* Results */}
          <section className="search-results">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Searching...</p>
              </div>
            ) : error ? (
              <div className="error-container">
                <h3>Search Error</h3>
                <p>{error}</p>
                <button
                  onClick={() => performSearch(query, currentPage, filter)}
                  className="retry-btn"
                >
                  Try Again
                </button>
              </div>
            ) : results.length === 0 && query ? (
              <div className="no-results">
                <div className="no-results-icon">🔍</div>
                <h3>No results found</h3>
                <p>Try adjusting your search terms or filters</p>
                <div className="search-suggestions">
                  <h4>Try searching for:</h4>
                  <div className="suggestion-tags">
                    <button onClick={() => handleNewSearch("Avengers")}>
                      Avengers
                    </button>
                    <button onClick={() => handleNewSearch("Game of Thrones")}>
                      Game of Thrones
                    </button>
                    <button onClick={() => handleNewSearch("Marvel")}>
                      Marvel
                    </button>
                    <button onClick={() => handleNewSearch("Comedy")}>
                      Comedy
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="results-grid">
                  {results.map((item) => renderSearchResult(item))}
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

                    <div className="pagination-numbers">
                      {renderPagination()}
                    </div>

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
        </>
      )}

      {!query && (
        <div className="search-empty">
          <div className="empty-search-icon">🎬</div>
          <h2>Search OLYMPIA</h2>
          <p>Discover movies and TV shows from our vast collection</p>
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
