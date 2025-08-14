import React, { useState } from "react";
import "./UtilityPages.css";

interface FAQItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

const FAQPage: React.FC = () => {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([
    {
      question: "How do I create an account?",
      answer:
        "Click the 'Sign Up' button in the top right corner of the page. Fill in your email address, create a password, and verify your email to get started.",
      isOpen: false,
    },
    {
      question: "What subscription plans are available?",
      answer:
        "We offer three plans: Basic (Free with ads), Premium ($9.99/month), and Premium Plus ($14.99/month with 4K streaming and multiple devices).",
      isOpen: false,
    },
    {
      question: "Can I download movies to watch offline?",
      answer:
        "Yes, Premium and Premium Plus subscribers can download movies and TV shows to watch offline on their mobile devices.",
      isOpen: false,
    },
    {
      question: "How many devices can I use?",
      answer:
        "Basic allows 1 device, Premium allows 2 devices simultaneously, and Premium Plus allows up to 4 devices at the same time.",
      isOpen: false,
    },
    {
      question: "How do I manage my watchlist?",
      answer:
        "Click the '+' icon on any movie or show to add it to your watchlist. Access your watchlist from the main navigation menu or your profile page.",
      isOpen: false,
    },
    {
      question: "What video quality do you support?",
      answer:
        "We support SD (480p), HD (720p), Full HD (1080p), and 4K Ultra HD depending on your subscription plan and device capabilities.",
      isOpen: false,
    },
    {
      question: "How do I cancel my subscription?",
      answer:
        "Go to Settings > Account > Subscription and click 'Cancel Subscription'. Your access will continue until the end of your current billing period.",
      isOpen: false,
    },
    {
      question: "Can I change my subscription plan?",
      answer:
        "Yes, you can upgrade or downgrade your plan anytime from your account settings. Changes take effect immediately for upgrades or at the next billing cycle for downgrades.",
      isOpen: false,
    },
    {
      question: "Do you offer parental controls?",
      answer:
        "Yes, create separate profiles with age restrictions and content filtering. Set up PIN protection for adult content in your account settings.",
      isOpen: false,
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards, PayPal, Apple Pay, Google Pay, and various regional payment methods depending on your location.",
      isOpen: false,
    },
  ]);

  const toggleFAQ = (index: number) => {
    setFaqItems((prevItems) =>
      prevItems.map((item, i) =>
        i === index ? { ...item, isOpen: !item.isOpen } : item
      )
    );
  };

  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>Frequently Asked Questions</h1>
          <p className="page-description">
            Find answers to common questions about using OLYMPIA
          </p>
        </div>

        <div className="info-content">
          <div className="faq-list">
            {faqItems.map((item, index) => (
              <div key={index} className="faq-item">
                <button
                  className={`faq-question ${item.isOpen ? "active" : ""}`}
                  onClick={() => toggleFAQ(index)}
                >
                  {item.question}
                </button>
                <div className={`faq-answer ${item.isOpen ? "active" : ""}`}>
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="faq-contact-section">
            <h3>Still have questions?</h3>
            <p>Contact our support team for personalized assistance.</p>
            <button
              className="btn btn-primary"
              onClick={() => (window.location.href = "/contact")}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
