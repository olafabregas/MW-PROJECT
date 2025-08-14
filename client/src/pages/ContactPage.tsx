import React, { useState } from "react";
import "./UtilityPages.css";
import { contactService } from "../services/contactService";

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await contactService.sendMessage(formData);
      setIsSubmitted(true);
      setFormData({
        name: "",
        email: "",
        subject: "general",
        message: "",
      });
    } catch (err) {
      // Optionally handle error (show error message to user)
      alert("Failed to send message. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="utility-page">
        <div className="container">
          <div className="page-header">
            <h1>Message Sent!</h1>
            <p className="page-description">
              Thank you for contacting us. We'll get back to you within 24
              hours.
            </p>
          </div>
          <div className="info-content">
            <div className="help-actions">
              <button
                className="btn btn-primary"
                onClick={() => setIsSubmitted(false)}
              >
                Send Another Message
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => (window.location.href = "/")}
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>Contact Us</h1>
          <p className="page-description">Get in touch with our support team</p>
        </div>

        <div className="info-content">
          <h2>🎬 Get Help</h2>
          <p>
            Have a question, suggestion, or need technical support? We're here
            to help! Fill out the form below and our team will respond within 24
            hours.
          </p>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
              >
                <option value="general">General Inquiry</option>
                <option value="technical">Technical Support</option>
                <option value="billing">Billing Question</option>
                <option value="content">Content Request</option>
                <option value="feedback">Feedback</option>
                <option value="bug">Report a Bug</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                placeholder="Tell us how we can help..."
                rows={6}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>
          </form>

          <h2>📧 Other Ways to Reach Us</h2>

          <div className="contact-methods">
            <div className="contact-method">
              <h3>📧 Email Support</h3>
              <p>support@olympia.com</p>
              <p>Response time: Within 24 hours</p>
            </div>

            <div className="contact-method">
              <h3>💬 Live Chat</h3>
              <p>Available 24/7 for Premium subscribers</p>
              <p>Click the chat icon in the bottom right</p>
            </div>

            <div className="contact-method">
              <h3>📞 Phone Support</h3>
              <p>+1 (555) 123-4567</p>
              <p>Mon-Fri: 9AM-6PM EST</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
