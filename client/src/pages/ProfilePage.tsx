import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authService } from "../services/authService";
import AuthModal from "../components/AuthModal";
import "./UtilityPages.css";

const ProfilePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      setLoading(false);
      return;
    }
    setShowAuthModal(false);
    setLoading(true);
    authService
      .getProfile()
      .then((user) => {
        setProfile(user);
        setEditForm(user);
        setError(null);
      })
      .catch((err) => {
        setError("Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const updated = await authService.updateProfile(editForm);
      setProfile(updated);
      setEditForm(updated);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  if (showAuthModal) {
    return (
      <AuthModal
        isOpen={true}
        onClose={() => setShowAuthModal(false)}
        initialTab="login"
      />
    );
  }
  if (loading) {
    return (
      <div className="utility-page">
        <div className="container">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="utility-page">
        <div className="container">
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!profile) {
    return null;
  }
  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>My Profile</h1>
          <p className="page-description">
            Manage your account information and preferences
          </p>
        </div>
        <div className="profile-container">
          {/* Profile Header */}
          <div className="profile-header">
            <div className="profile-image-section">
              <div className="profile-image">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="Profile" />
                ) : (
                  <div className="default-avatar">
                    <span>👤</span>
                  </div>
                )}
              </div>
              <button className="btn btn-secondary btn-sm">Change Photo</button>
            </div>
            <div className="profile-info">
              <h2>{profile.username || profile.name}</h2>
              <p className="email">{profile.email}</p>
              <div className="membership-badge">
                <span className="badge premium">
                  {profile.role
                    ? profile.role.charAt(0).toUpperCase() +
                      profile.role.slice(1)
                    : "User"}
                </span>
                <span className="member-since">
                  {profile.createdAt
                    ? `Since ${new Date(profile.createdAt).getFullYear()}`
                    : ""}
                </span>
              </div>
            </div>
            <div className="profile-actions">
              {!isEditing ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              ) : (
                <div className="edit-actions">
                  <button className="btn btn-primary" onClick={handleSave}>
                    Save
                  </button>
                  <button className="btn btn-secondary" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Profile Content */}
          <div className="profile-content">
            {/* Stats Section */}
            <div className="profile-section">
              <h3>Your Stats</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🎬</div>
                  <div className="stat-info">
                    <span className="stat-number">
                      {profile.stats?.moviesWatched ?? 0}
                    </span>
                    <span className="stat-label">Movies Watched</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📋</div>
                  <div className="stat-info">
                    <span className="stat-number">
                      {profile.stats?.totalReviews ?? 0}
                    </span>
                    <span className="stat-label">Reviews</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-info">
                    <span className="stat-number">
                      {profile.stats?.totalLikes ?? 0}
                    </span>
                    <span className="stat-label">Likes</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Personal Information */}
            <div className="profile-section">
              <h3>Personal Information</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Username</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.username || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, username: e.target.value })
                      }
                      className="form-input"
                      placeholder="Enter your username"
                      aria-label="Username"
                    />
                  ) : (
                    <p className="form-value">{profile.username}</p>
                  )}
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="form-input"
                      placeholder="Enter your email address"
                      aria-label="Email Address"
                    />
                  ) : (
                    <p className="form-value">{profile.email}</p>
                  )}
                </div>
              </div>
            </div>
            {/* Favorite Genres */}
            {profile.favoriteGenres && (
              <div className="profile-section">
                <h3>Favorite Genres</h3>
                <div className="genres-list">
                  {profile.favoriteGenres.map(
                    (genre: string, index: number) => (
                      <span key={index} className="genre-badge">
                        {genre}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
