import React, { useState } from "react";
import "./UtilityPages.css";

interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisible: boolean;
    watchlistPublic: boolean;
    showActivity: boolean;
  };
  preferences: {
    language: string;
    theme: string;
    autoPlay: boolean;
    quality: string;
  };
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      push: false,
      sms: false,
    },
    privacy: {
      profileVisible: true,
      watchlistPublic: false,
      showActivity: true,
    },
    preferences: {
      language: "en",
      theme: "dark",
      autoPlay: true,
      quality: "hd",
    },
  });

  const [hasChanges, setHasChanges] = useState(false);

  const updateSetting = (
    category: keyof UserSettings,
    key: string,
    value: boolean | string
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const saveSettings = () => {
    // In real app, save to backend
    setHasChanges(false);
    console.log("Settings saved:", settings);
  };

  const resetSettings = () => {
    setSettings({
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
      privacy: {
        profileVisible: true,
        watchlistPublic: false,
        showActivity: true,
      },
      preferences: {
        language: "en",
        theme: "dark",
        autoPlay: true,
        quality: "hd",
      },
    });
    setHasChanges(true);
  };

  return (
    <div className="utility-page">
      <div className="container">
        <div className="page-header">
          <h1>Settings</h1>
          <p className="page-description">Customize your OLYMPIA experience</p>
        </div>

        <div className="settings-container">
          {/* Notification Settings */}
          <div className="settings-section">
            <h3>Notifications</h3>
            <p className="section-description">
              Choose how you want to be notified about new content and updates
            </p>

            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="email-notifications">
                    Email Notifications
                  </label>
                  <p>Receive updates about new releases and recommendations</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="email-notifications"
                    checked={settings.notifications.email}
                    onChange={(e) =>
                      updateSetting("notifications", "email", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="push-notifications">Push Notifications</label>
                  <p>Get notified about trending content and updates</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="push-notifications"
                    checked={settings.notifications.push}
                    onChange={(e) =>
                      updateSetting("notifications", "push", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="sms-notifications">SMS Notifications</label>
                  <p>Receive important account updates via text</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="sms-notifications"
                    checked={settings.notifications.sms}
                    onChange={(e) =>
                      updateSetting("notifications", "sms", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="settings-section">
            <h3>Privacy</h3>
            <p className="section-description">
              Control who can see your profile and activity
            </p>

            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="profile-visible">Public Profile</label>
                  <p>Make your profile visible to other users</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="profile-visible"
                    checked={settings.privacy.profileVisible}
                    onChange={(e) =>
                      updateSetting(
                        "privacy",
                        "profileVisible",
                        e.target.checked
                      )
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="watchlist-public">Public Watchlist</label>
                  <p>Allow others to see your watchlist</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="watchlist-public"
                    checked={settings.privacy.watchlistPublic}
                    onChange={(e) =>
                      updateSetting(
                        "privacy",
                        "watchlistPublic",
                        e.target.checked
                      )
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="show-activity">Show Activity</label>
                  <p>Display your viewing activity to friends</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="show-activity"
                    checked={settings.privacy.showActivity}
                    onChange={(e) =>
                      updateSetting("privacy", "showActivity", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="settings-section">
            <h3>Preferences</h3>
            <p className="section-description">
              Customize your viewing experience
            </p>

            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="language">Language</label>
                  <p>Choose your preferred language</p>
                </div>
                <select
                  id="language"
                  className="setting-select"
                  value={settings.preferences.language}
                  onChange={(e) =>
                    updateSetting("preferences", "language", e.target.value)
                  }
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="theme">Theme</label>
                  <p>Choose your preferred color theme</p>
                </div>
                <select
                  id="theme"
                  className="setting-select"
                  value={settings.preferences.theme}
                  onChange={(e) =>
                    updateSetting("preferences", "theme", e.target.value)
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="auto-play">Auto Play</label>
                  <p>Automatically play trailers and previews</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="auto-play"
                    checked={settings.preferences.autoPlay}
                    onChange={(e) =>
                      updateSetting("preferences", "autoPlay", e.target.checked)
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="quality">Default Quality</label>
                  <p>Set your preferred video quality</p>
                </div>
                <select
                  id="quality"
                  className="setting-select"
                  value={settings.preferences.quality}
                  onChange={(e) =>
                    updateSetting("preferences", "quality", e.target.value)
                  }
                >
                  <option value="sd">SD (480p)</option>
                  <option value="hd">HD (720p)</option>
                  <option value="fhd">Full HD (1080p)</option>
                  <option value="4k">4K Ultra HD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="settings-actions">
            <button
              className="btn btn-primary"
              onClick={saveSettings}
              disabled={!hasChanges}
            >
              Save Changes
            </button>
            <button className="btn btn-secondary" onClick={resetSettings}>
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
