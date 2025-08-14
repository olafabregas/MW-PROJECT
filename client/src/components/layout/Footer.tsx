import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Logo and Tagline */}
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="footer-logo-icon">🎬</span>
              <span className="footer-logo-text">OLYMPIA</span>
            </div>
            <p className="footer-tagline">
              Your Gateway to the World of Cinema
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-links">
            <div className="footer-column">
              <h4 className="footer-title">Browse</h4>
              <ul className="footer-list">
                <li>
                  <Link to="/movies" className="footer-link">
                    Movies
                  </Link>
                </li>
                <li>
                  <Link to="/tv-shows" className="footer-link">
                    TV Shows
                  </Link>
                </li>
                <li>
                  <Link to="/new-releases" className="footer-link">
                    New Releases
                  </Link>
                </li>
                <li>
                  <Link to="/top-rated" className="footer-link">
                    Top Rated
                  </Link>
                </li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-title">Account</h4>
              <ul className="footer-list">
                <li>
                  <Link to="/watchlist" className="footer-link">
                    My Watchlist
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className="footer-link">
                    Profile
                  </Link>
                </li>
                <li>
                  <Link to="/settings" className="footer-link">
                    Settings
                  </Link>
                </li>
                <li>
                  <Link to="/help" className="footer-link">
                    Help Center
                  </Link>
                </li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-title">Company</h4>
              <ul className="footer-list">
                <li>
                  <Link to="/about" className="footer-link">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="footer-link">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="footer-link">
                    F.A.Q
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="footer-link">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="footer-link">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="footer-column">
              <h4 className="footer-title">Connect</h4>
              <div className="social-links">
                <a
                  href="https://facebook.com/olympia"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📘
                </a>
                <a
                  href="https://twitter.com/olympia"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🐦
                </a>
                <a
                  href="https://instagram.com/olympia"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📷
                </a>
                <a
                  href="https://tiktok.com/@olympia"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🎵
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p className="copyright">
              © 2025 OLYMPIA. All rights reserved. Premium streaming experience.
            </p>
            <div className="footer-badges">
              <span className="quality-badge">4K Ultra HD</span>
              <span className="quality-badge">Dolby Atmos</span>
              <span className="quality-badge">HDR10+</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
