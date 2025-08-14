import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./WatchlistPage.css";
import { useAuth } from "../hooks/useAuth";
import { watchlistService } from "../services/watchlistService";
import type { WatchlistItem } from "../services/watchlistService";
import AuthModal from "../components/AuthModal";

const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [filteredWatchlist, setFilteredWatchlist] = useState<WatchlistItem[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "movies" | "tv">("all");
  const [sortBy, setSortBy] = useState<"dateAdded" | "title" | "rating">(
    "dateAdded"
  );
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      setLoading(false);
      return;
    }
    setShowAuthModal(false);
    setLoading(true);
    watchlistService
      .getWatchlist()
      .then((data) => {
        setWatchlist(data);
        setFilteredWatchlist(data);
      })
      .catch(() => {
        setWatchlist([]);
        setFilteredWatchlist([]);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  // Filter and sort watchlist
  useEffect(() => {
    let filtered = [...watchlist];

    // Apply filter
    if (filter !== "all") {
      filtered = filtered.filter((item) => item.type === filter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "dateAdded":
          return (
            new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
          );
        case "title": {
          const titleA = a.type === "movie" ? a.title : a.name;
          const titleB = b.type === "movie" ? b.title : b.name;
          return (titleA || "").localeCompare(titleB || "");
        }
        case "rating":
          return b.vote_average - a.vote_average;
        default:
          return 0;
      }
    });

    setFilteredWatchlist(filtered);
  }, [watchlist, filter, sortBy]);

  const handleItemClick = (item: WatchlistItem) => {
    if (item.type === "movie") {
      navigate(`/movie/${item.id}`);
    } else {
      navigate(`/tv-show/${item.id}`);
    }
  };

  const removeFromWatchlist = (id: number, type: "movie" | "tv") => {
    const updatedWatchlist = watchlist.filter(
      (item) => !(item.id === id && item.type === type)
    );
    setWatchlist(updatedWatchlist);
    // Here you would also make an API call to update the backend
  };

  const clearWatchlist = () => {
    setWatchlist([]);
    // Here you would also make an API call to clear the backend
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderWatchlistItem = (item: WatchlistItem) => {
    const title = item.type === "movie" ? item.title : item.name;
    const releaseDate =
      item.type === "movie" ? item.release_date : item.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : "TBA";

    return (
      <div key={`${item.type}-${item.id}`} className="watchlist-item">
        <div className="item-poster" onClick={() => handleItemClick(item)}>
          <img
            src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
            alt={title}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/api/placeholder/150/225";
            }}
          />
          <div className="item-overlay">
            <button className="play-button">▶</button>
          </div>
        </div>
        <div className="item-info">
          <div className="item-header">
            <h3 className="item-title" onClick={() => handleItemClick(item)}>
              {title}
            </h3>
            <button
              className="remove-btn"
              onClick={() => removeFromWatchlist(item.id, item.type)}
              title="Remove from watchlist"
            >
              ✕
            </button>
          </div>
          <div className="item-details">
            <span className="item-year">{year}</span>
            <span className="item-type">
              {item.type === "movie" ? "Movie" : "TV Show"}
            </span>
            <span className="item-rating">
              ⭐ {item.vote_average.toFixed(1)}
            </span>
          </div>
          <p className="item-overview">{item.overview}</p>
          <div className="item-meta">
            <span className="date-added">
              Added: {formatDate(item.dateAdded)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="watchlist-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your watchlist...</p>
        </div>
      </div>
    );
  }

  if (showAuthModal) {
    return (
      <>
        {
          <AuthModal
            isOpen={true}
            onClose={() => setShowAuthModal(false)}
            initialTab="login"
          />
        }
      </>
    );
  }

  return (
    <div className="watchlist-page">
      {/* Header */}
      <section className="watchlist-header">
        <div className="header-content">
          <h1 className="page-title">My Watchlist</h1>
          <p className="page-subtitle">
            Keep track of movies and TV shows you want to watch
          </p>
          <div className="watchlist-stats">
            <span className="stat">
              <strong>{filteredWatchlist.length}</strong> items
            </span>
            <span className="stat">
              <strong>
                {
                  filteredWatchlist.filter((item) => item.type === "movie")
                    .length
                }
              </strong>{" "}
              movies
            </span>
            <span className="stat">
              <strong>
                {filteredWatchlist.filter((item) => item.type === "tv").length}
              </strong>{" "}
              TV shows
            </span>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section className="watchlist-controls">
        <div className="controls-container">
          <div className="filter-controls">
            <div className="filter-group">
              <label>Filter:</label>
              <select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as "all" | "movies" | "tv")
                }
                className="filter-select"
                aria-label="Filter watchlist items"
              >
                <option value="all">All Items</option>
                <option value="movies">Movies Only</option>
                <option value="tv">TV Shows Only</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "dateAdded" | "title" | "rating")
                }
                className="filter-select"
                aria-label="Sort watchlist items"
              >
                <option value="dateAdded">Date Added</option>
                <option value="title">Title</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>

          {watchlist.length > 0 && (
            <button onClick={clearWatchlist} className="clear-btn">
              Clear All
            </button>
          )}
        </div>
      </section>

      {/* Watchlist Content */}
      <section className="watchlist-content">
        {filteredWatchlist.length === 0 ? (
          <div className="empty-watchlist">
            <div className="empty-icon">📝</div>
            <h3>Your watchlist is empty</h3>
            <p>Start adding movies and TV shows you want to watch!</p>
            <div className="empty-actions">
              <button
                onClick={() => navigate("/movies")}
                className="btn btn-primary"
              >
                Browse Movies
              </button>
              <button
                onClick={() => navigate("/tv-shows")}
                className="btn btn-secondary"
              >
                Browse TV Shows
              </button>
            </div>
          </div>
        ) : (
          <div className="watchlist-grid">
            {filteredWatchlist.map((item) => renderWatchlistItem(item))}
          </div>
        )}
      </section>
    </div>
  );
};

export default WatchlistPage;
