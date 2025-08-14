import React from "react";
import "./UtilityPages.css";

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>Terms of Service</h1>
          <p className="page-description">
            Terms and conditions for using OLYMPIA
          </p>
        </div>

        <div className="info-content">
          <p>
            <strong>Last updated:</strong> December 2024
          </p>

          <h2>🎬 Welcome to OLYMPIA</h2>
          <p>
            These Terms of Service ("Terms") govern your use of the OLYMPIA
            streaming service. By creating an account or using our service, you
            agree to these Terms.
          </p>

          <h2>📝 Account Registration</h2>
          <ul>
            <li>You must be at least 18 years old to create an account</li>
            <li>You must provide accurate and complete information</li>
            <li>You are responsible for maintaining account security</li>
            <li>One person may not maintain more than one account</li>
            <li>You may not share your account credentials</li>
          </ul>

          <h2>💳 Subscription and Payment</h2>

          <h3>Billing</h3>
          <ul>
            <li>Subscriptions automatically renew until cancelled</li>
            <li>You will be charged at the beginning of each billing cycle</li>
            <li>Prices may change with 30 days notice</li>
            <li>All fees are non-refundable except as required by law</li>
          </ul>

          <h3>Free Trials</h3>
          <p>
            Free trials are available for new subscribers only. You will be
            charged when the trial ends unless you cancel before the trial
            period expires.
          </p>

          <h2>🎭 Content and Usage</h2>

          <h3>License to Use</h3>
          <p>
            We grant you a limited, non-exclusive license to stream content for
            personal, non-commercial use only. You may not:
          </p>
          <ul>
            <li>
              Copy, download, or distribute content (except where allowed)
            </li>
            <li>Use content for commercial purposes</li>
            <li>Attempt to circumvent technical protection measures</li>
            <li>Share your account with others outside your household</li>
          </ul>

          <h3>Content Availability</h3>
          <p>
            Content availability may vary by location and can change without
            notice. We do not guarantee that specific content will remain
            available.
          </p>

          <h2>👤 User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the service for illegal purposes</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Upload viruses or malicious code</li>
            <li>Attempt to hack or compromise our systems</li>
            <li>Create fake accounts or impersonate others</li>
            <li>Spam or send unsolicited communications</li>
          </ul>

          <h2>📱 Supported Devices</h2>
          <p>
            You may access OLYMPIA on supported devices. The number of
            simultaneous streams depends on your subscription plan. We may limit
            the number of devices associated with your account.
          </p>

          <h2>🔒 Intellectual Property</h2>
          <p>
            All content and materials on OLYMPIA are protected by copyright and
            other intellectual property laws. OLYMPIA and its licensors own all
            rights to the service and content.
          </p>

          <h2>⚠️ Disclaimers and Limitations</h2>

          <h3>Service Availability</h3>
          <p>
            We strive for 99.9% uptime but cannot guarantee uninterrupted
            service. We may perform maintenance that temporarily affects service
            availability.
          </p>

          <h3>Limitation of Liability</h3>
          <p>
            OLYMPIA is not liable for indirect, incidental, or consequential
            damages. Our total liability is limited to the amount you paid for
            the service in the past 12 months.
          </p>

          <h2>🔄 Account Termination</h2>

          <h3>By You</h3>
          <p>
            You may cancel your subscription anytime through your account
            settings. Your access continues until the end of your billing
            period.
          </p>

          <h3>By Us</h3>
          <p>
            We may suspend or terminate your account if you violate these Terms
            or engage in fraudulent activity.
          </p>

          <h2>⚖️ Dispute Resolution</h2>
          <p>
            Any disputes will be resolved through binding arbitration rather
            than court proceedings, except where prohibited by law.
          </p>

          <h2>📍 Governing Law</h2>
          <p>
            These Terms are governed by the laws of California, United States,
            without regard to conflict of law principles.
          </p>

          <h2>📞 Contact Information</h2>
          <p>Questions about these Terms? Contact us at:</p>
          <p>
            <strong>Email:</strong> legal@olympia.com
            <br />
            <strong>Address:</strong> OLYMPIA Legal Department, 123
            Entertainment Blvd, Los Angeles, CA 90210
          </p>

          <h2>🔄 Changes to Terms</h2>
          <p>
            We may modify these Terms from time to time. We'll notify you of
            material changes and your continued use constitutes acceptance of
            the updated Terms.
          </p>

          <div className="help-actions">
            <button
              className="btn btn-secondary"
              onClick={() => (window.location.href = "/contact")}
            >
              Contact Legal Team
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (window.location.href = "/privacy")}
            >
              View Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
