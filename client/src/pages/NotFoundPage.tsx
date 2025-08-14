import React from "react";
import { Link } from "react-router-dom";
import "./ErrorPages.css";

const NotFoundPage: React.FC = () => {
  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">🎬</div>
          <h1 className="error-code">404</h1>
          <h2 className="error-title">Page Not Found</h2>
          <p className="error-message">
            Sorry, the page you're looking for doesn't exist. It might have been
            removed, renamed, or didn't exist in the first place.
          </p>

          <div className="error-actions">
            <Link to="/" className="btn btn-primary">
              Go Home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="btn btn-secondary"
            >
              Go Back
            </button>
          </div>

          <div className="error-suggestions">
            <h3>You might be interested in:</h3>
            <div className="suggestion-links">
              <Link to="/movies" className="suggestion-link">
                <span className="suggestion-icon">🎬</span>
                Browse Movies
              </Link>
              <Link to="/tv-shows" className="suggestion-link">
                <span className="suggestion-icon">📺</span>
                TV Shows
              </Link>
              <Link to="/search" className="suggestion-link">
                <span className="suggestion-icon">🔍</span>
                Search
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
