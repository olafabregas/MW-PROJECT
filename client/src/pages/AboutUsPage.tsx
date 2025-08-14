import React from "react";
import "./UtilityPages.css";

const AboutUsPage: React.FC = () => {
  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>About OLYMPIA</h1>
          <p className="page-description">
            Your Gateway to the World of Cinema
          </p>
        </div>

        <div className="info-content">
          <h2>🎬 Our Story</h2>
          <p>
            OLYMPIA was founded with a simple mission: to bring the magic of
            cinema to everyone, everywhere. We believe that great storytelling
            transcends boundaries and connects us all through shared
            experiences.
          </p>

          <p>
            Since our launch, we've grown from a small team of movie enthusiasts
            to a global platform serving millions of users worldwide. Our
            commitment remains unchanged—delivering the highest quality
            entertainment experience possible.
          </p>

          <h2>✨ What Sets Us Apart</h2>

          <h3>Cutting-Edge Technology</h3>
          <p>
            Experience cinema like never before with our advanced streaming
            technology. We support 4K Ultra HD, HDR10+, and Dolby Atmos for an
            immersive viewing experience that rivals the theater.
          </p>

          <h3>Curated Content</h3>
          <p>
            Our expert curation team handpicks the best movies and TV shows from
            around the world. From blockbusters to hidden gems, we ensure every
            title meets our high standards for quality entertainment.
          </p>

          <h3>Smart Recommendations</h3>
          <p>
            Our AI-powered recommendation engine learns your preferences to
            suggest content you'll love. Discover new favorites and revisit
            classics tailored to your unique taste.
          </p>

          <h2>🌟 Our Values</h2>

          <h3>Quality First</h3>
          <p>
            We never compromise on quality—from the content we select to the
            streaming experience we deliver. Every detail is crafted to exceed
            your expectations.
          </p>

          <h3>Innovation</h3>
          <p>
            We're constantly pushing the boundaries of what's possible in
            digital entertainment, incorporating the latest technologies to
            enhance your viewing experience.
          </p>

          <h3>Community</h3>
          <p>
            OLYMPIA is more than a streaming service—it's a community of film
            lovers. We foster discussions, share recommendations, and celebrate
            the art of storytelling together.
          </p>

          <h2>🚀 Looking Forward</h2>
          <p>
            As we continue to grow, we remain committed to our core mission:
            making exceptional entertainment accessible to all. We're expanding
            our content library, enhancing our technology, and building features
            that make discovering great content easier than ever.
          </p>

          <p>
            Thank you for being part of the OLYMPIA journey. Together, we're
            redefining how the world experiences cinema.
          </p>

          <div className="help-actions">
            <button
              className="btn btn-primary"
              onClick={() => (window.location.href = "/signup")}
            >
              Join OLYMPIA
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => (window.location.href = "/contact")}
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUsPage;
