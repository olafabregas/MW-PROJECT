import React from "react";
import "./UtilityPages.css";

const HelpCenterPage: React.FC = () => {
  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>Help Center</h1>
          <p className="page-description">
            Get help with your OLYMPIA experience
          </p>
        </div>

        <div className="info-content">
          <h2>🎬 Getting Started</h2>
          <p>
            Welcome to OLYMPIA! Here's everything you need to know to get
            started with your premium streaming experience.
          </p>

          <h3>Creating Your Account</h3>
          <p>
            Sign up with your email address and create a secure password. Verify
            your email to activate your account and start exploring thousands of
            movies and TV shows.
          </p>

          <h3>Choosing Your Plan</h3>
          <ul>
            <li>
              <strong>Basic (Free):</strong> Access to our content library with
              ads, SD quality, 1 device
            </li>
            <li>
              <strong>Premium ($9.99/month):</strong> Ad-free streaming, HD
              quality, 2 devices, offline downloads
            </li>
            <li>
              <strong>Premium Plus ($14.99/month):</strong> Everything in
              Premium plus 4K Ultra HD, 4 devices, Dolby Atmos
            </li>
          </ul>

          <h2>🎭 Using OLYMPIA</h2>

          <h3>Browsing Content</h3>
          <p>
            Use our powerful search and filtering tools to find exactly what
            you're looking for. Browse by genre, year, rating, or use our smart
            recommendations.
          </p>

          <h3>Managing Your Watchlist</h3>
          <p>
            Save movies and shows to watch later by clicking the '+' icon.
            Access your watchlist anytime from the navigation menu.
          </p>

          <h3>Profile Settings</h3>
          <p>
            Customize your experience by updating your profile, setting
            preferences, and managing privacy settings in your account
            dashboard.
          </p>

          <h2>🔧 Technical Support</h2>

          <h3>Video Quality Issues</h3>
          <p>
            If you're experiencing buffering or quality issues, check your
            internet connection and try adjusting the quality settings in the
            player.
          </p>

          <h3>Supported Devices</h3>
          <p>
            OLYMPIA works on computers, smartphones, tablets, smart TVs, and
            streaming devices. Download our apps from your device's app store.
          </p>

          <h3>Account Issues</h3>
          <p>
            For billing questions, password resets, or account management, visit
            your account settings or contact our support team.
          </p>

          <h2>💬 Contact Support</h2>
          <p>
            Can't find what you're looking for? Our support team is here to help
            24/7.
          </p>

          <div className="help-actions">
            <button
              className="btn btn-primary"
              onClick={() => (window.location.href = "/contact")}
            >
              Contact Support
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => (window.location.href = "/faq")}
            >
              View FAQ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenterPage;
