import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Header.css";

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setIsSearchOpen(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e as unknown as React.FormEvent);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo Section */}
        <div className="header-logo">
          <Link to="/" className="logo-button">
            <div className="logo-icon">🎬</div>
            <span className="logo-text">OLYMPIA</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className={`header-nav ${isMenuOpen ? "nav-open" : ""}`}>
          <ul className="nav-list">
            <li>
              <Link
                to="/"
                className={`nav-link ${isActive("/") ? "active" : ""}`}
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/movies"
                className={`nav-link ${isActive("/movies") ? "active" : ""}`}
              >
                Movies
              </Link>
            </li>
            <li>
              <Link
                to="/tv-shows"
                className={`nav-link ${isActive("/tv-shows") ? "active" : ""}`}
              >
                TV Shows
              </Link>
            </li>
            <li>
              <Link
                to="/watchlist"
                className={`nav-link ${isActive("/watchlist") ? "active" : ""}`}
              >
                My List
              </Link>
            </li>
          </ul>
        </nav>

        {/* Right Section */}
        <div className="header-actions">
          {/* Search */}
          <div
            className={`search-container ${isSearchOpen ? "search-open" : ""}`}
          >
            <button
              className="search-toggle"
              onClick={toggleSearch}
              aria-label="Toggle search"
            >
              🔍
            </button>
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search movies, TV shows..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
              />
            </form>
          </div>

          {/* Profile */}
          <div className="profile-menu">
            <button className="profile-button" aria-label="Profile menu">
              <div className="profile-avatar">👤</div>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={toggleMenu}
            aria-label="Toggle mobile menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
