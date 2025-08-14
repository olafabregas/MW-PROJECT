import React from "react";
import "./UtilityPages.css";

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>Privacy Policy</h1>
          <p className="page-description">
            How we collect, use, and protect your information
          </p>
        </div>

        <div className="info-content">
          <p>
            <strong>Last updated:</strong> December 2024
          </p>

          <h2>🔒 Information We Collect</h2>

          <h3>Account Information</h3>
          <p>
            When you create an OLYMPIA account, we collect your email address,
            password, and any profile information you choose to provide.
          </p>

          <h3>Usage Data</h3>
          <p>
            We collect information about how you use our service, including what
            content you watch, your viewing preferences, and device information.
          </p>

          <h3>Technical Information</h3>
          <p>
            We automatically collect technical data such as your IP address,
            browser type, operating system, and device identifiers to provide
            and improve our service.
          </p>

          <h2>🎯 How We Use Your Information</h2>

          <ul>
            <li>To provide and maintain our streaming service</li>
            <li>To personalize your experience and recommend content</li>
            <li>To process payments and manage subscriptions</li>
            <li>To communicate with you about service updates</li>
            <li>To analyze usage patterns and improve our platform</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>

          <h2>🤝 Information Sharing</h2>

          <h3>We DO NOT sell your personal information.</h3>

          <p>
            We may share your information only in these limited circumstances:
          </p>
          <ul>
            <li>With service providers who help us operate our platform</li>
            <li>When required by law or to protect our rights</li>
            <li>In connection with a business transaction</li>
            <li>With your consent for specific purposes</li>
          </ul>

          <h2>🍪 Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to enhance your experience,
            remember your preferences, and analyze site usage. You can control
            cookie settings through your browser.
          </p>

          <h2>🛡️ Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your
            information, including encryption, secure servers, and regular
            security audits. However, no system is 100% secure.
          </p>

          <h2>🌍 International Transfers</h2>
          <p>
            Your information may be processed in countries other than your own.
            We ensure appropriate safeguards are in place to protect your data
            during international transfers.
          </p>

          <h2>⏰ Data Retention</h2>
          <p>
            We retain your information only as long as necessary to provide our
            services and fulfill legal obligations. Account information is
            typically retained until you delete your account.
          </p>

          <h2>👤 Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account and data</li>
            <li>Object to certain processing activities</li>
            <li>Port your data to another service</li>
            <li>Withdraw consent where applicable</li>
          </ul>

          <h2>👶 Children's Privacy</h2>
          <p>
            Our service is not intended for children under 13. We do not
            knowingly collect personal information from children under 13. If
            you believe we have collected such information, please contact us
            immediately.
          </p>

          <h2>🔄 Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We'll notify
            you of significant changes through email or our service. Your
            continued use constitutes acceptance of the updated policy.
          </p>

          <h2>📧 Contact Us</h2>
          <p>
            If you have questions about this privacy policy or our data
            practices, contact us at:
          </p>
          <p>
            <strong>Email:</strong> privacy@olympia.com
            <br />
            <strong>Address:</strong> OLYMPIA Privacy Team, 123 Entertainment
            Blvd, Los Angeles, CA 90210
          </p>

          <div className="help-actions">
            <button
              className="btn btn-secondary"
              onClick={() => (window.location.href = "/contact")}
            >
              Contact Privacy Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
