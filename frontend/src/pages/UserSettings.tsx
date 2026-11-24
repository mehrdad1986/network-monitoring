import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './UserSettings.css';
import { useSearchParams } from 'react-router-dom';
import { AppearanceSettings } from '../components/AppearanceSettings';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  profilePicture?: string;
  phone?: string;
  location?: string;
  bio?: string;
}

interface Preferences {
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  emailDigest: 'daily' | 'weekly' | 'monthly' | 'never';
  sidebarCollapsed: boolean;
  compactView: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: string;
  activeDevices: number;
  loginAttempts: number;
}

export default function UserSettings() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') || 'profile';
  const activeTab = ['profile', 'appearance', 'preferences', 'notifications', 'security', 'danger'].includes(requestedTab) ? requestedTab : 'profile';
  const setActiveTab = (tab: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', tab); return next; });
  const [profilePicture, setProfilePicture] = useState<string | null>(
    'https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff'
  );
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    id: '1',
    username: 'johndoe',
    email: 'john@netmon.local',
    fullName: 'John Doe',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    bio: 'Network monitoring enthusiast',
    profilePicture: profilePicture || undefined,
  });

  const [preferences, setPreferences] = useState<Preferences>({
    language: 'en',
    timezone: 'UTC-8',
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    emailDigest: 'daily',
    sidebarCollapsed: false,
    compactView: false,
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: true,
    lastPasswordChange: '2026-08-15',
    activeDevices: 3,
    loginAttempts: 0,
  });

  const [formData, setFormData] = useState<UserProfile>(profile);

  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setProfilePicture(imageUrl);
        setProfile({ ...profile, profilePicture: imageUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePicture = () => {
    setProfilePicture(null);
    setProfile({ ...profile, profilePicture: undefined });
  };

  const handleSaveProfile = () => {
    setProfile(formData);
    setIsEditingProfile(false);
  };

  const handleNotificationChange = (type: keyof Preferences['notifications']) => {
    setPreferences({
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [type]: !preferences.notifications[type],
      },
    });
  };

  const handleDeleteAccount = () => {
    console.log('Account deletion initiated');
    setShowDeleteConfirm(false);
  };

  return (
    <div className="user-settings">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="settings-subtitle">Manage your account, preferences, and security</p>
      </div>

      <div className="settings-container">
        <div className="settings-sidebar">
          <button
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UIIcon symbol="👤" /> Profile
          </button>
          <button
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <UIIcon symbol="🎨" /> Appearance
          </button>
          <button
            className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <UIIcon symbol="⚙️" /> Preferences
          </button>
          <button
            className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <UIIcon symbol="🔔" /> Notifications
          </button>
          <button
            className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <UIIcon symbol="🔒" /> Security
          </button>
          <button
            className={`settings-tab danger ${activeTab === 'danger' ? 'active' : ''}`}
            onClick={() => setActiveTab('danger')}
          >
            <UIIcon symbol="⚠️" /> Danger Zone
          </button>
        </div>

        <div className="settings-content">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>Profile Settings</h2>

              <div className="profile-picture-section">
                <div className="picture-container">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="profile-image" />
                  ) : (
                    <div className="profile-image-placeholder">
                      <span className="placeholder-icon"><UIIcon symbol="📷" /></span>
                    </div>
                  )}
                </div>

                <div className="picture-actions">
                  <label className="upload-btn">
                    <UIIcon symbol="📤" /> Upload Profile Picture
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {profilePicture && (
                    <button className="remove-btn" onClick={handleRemoveProfilePicture}>
                      <UIIcon symbol="🗑️" /> Remove Picture
                    </button>
                  )}
                </div>
                <p className="picture-info">Recommended size: 512x512px. Max 5MB.</p>
              </div>

              <div className="divider"></div>

              {!isEditingProfile ? (
                <div className="profile-view">
                  <div className="info-row">
                    <span className="info-label">Username:</span>
                    <span className="info-value">{profile.username}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Full Name:</span>
                    <span className="info-value">{profile.fullName}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{profile.email}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Phone:</span>
                    <span className="info-value">{profile.phone || 'Not set'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Location:</span>
                    <span className="info-value">{profile.location || 'Not set'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Bio:</span>
                    <span className="info-value">{profile.bio || 'Not set'}</span>
                  </div>

                  <button
                    className="edit-btn"
                    onClick={() => {
                      setFormData(profile);
                      setIsEditingProfile(true);
                    }}
                  >
                    <UIIcon symbol="✏️" /> Edit Profile
                  </button>
                </div>
              ) : (
                <div className="profile-form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="form-input"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="form-input"
                      placeholder="City, State"
                    />
                  </div>

                  <div className="form-group">
                    <label>Bio</label>
                    <textarea
                      value={formData.bio || ''}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      className="form-input textarea"
                      placeholder="Tell us about yourself"
                      rows={4}
                    />
                  </div>

                  <div className="form-actions">
                    <button className="btn-save" onClick={handleSaveProfile}>
                      <UIIcon symbol="💾" /> Save Changes
                    </button>
                    <button className="btn-cancel" onClick={() => setIsEditingProfile(false)}>
                      <UIIcon symbol="❌" /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && <AppearanceSettings />}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="settings-section">
              <h2>Preferences</h2>

              <div className="setting-group">
                <h3>General Preferences</h3>

                <div className="form-group">
                  <label>Dashboard Layout</label>
                  <select className="form-input">
                    <option value="default">Default</option>
                    <option value="compact">Compact</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Default Time Range</label>
                  <select className="form-input">
                    <option value="1h">Last 1 Hour</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Charts Per Page</label>
                  <select className="form-input">
                    <option value="6">6</option>
                    <option value="9">9</option>
                    <option value="12">12</option>
                    <option value="15">15</option>
                  </select>
                </div>
              </div>

              <div className="divider"></div>

              <div className="setting-group">
                <h3>Data & Privacy</h3>

                <div className="toggle-setting">
                  <label>
                    <input type="checkbox" defaultChecked />
                    <span>Allow Analytics</span>
                  </label>
                  <p className="toggle-description">Help us improve by sharing anonymous usage data</p>
                </div>

                <div className="toggle-setting">
                  <label>
                    <input type="checkbox" defaultChecked />
                    <span>Keep Me Logged In</span>
                  </label>
                  <p className="toggle-description">Remember this device for 30 days</p>
                </div>

                <div className="toggle-setting">
                  <label>
                    <input type="checkbox" />
                    <span>Hide Sensitive Data</span>
                  </label>
                  <p className="toggle-description">Mask IP addresses and sensitive information</p>
                </div>
              </div>

              <button className="btn-save" style={{ marginTop: '1.5rem' }}>
                <UIIcon symbol="💾" /> Save Preferences
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h2>Notification Settings</h2>

              <div className="setting-group">
                <h3>Notification Channels</h3>

                <div className="toggle-setting">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.notifications.email}
                      onChange={() => handleNotificationChange('email')}
                    />
                    <span>Email Notifications</span>
                  </label>
                  <p className="toggle-description">Receive notifications via email</p>
                </div>

                <div className="toggle-setting">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.notifications.push}
                      onChange={() => handleNotificationChange('push')}
                    />
                    <span>Push Notifications</span>
                  </label>
                  <p className="toggle-description">Get browser and mobile push notifications</p>
                </div>

                <div className="toggle-setting">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.notifications.sms}
                      onChange={() => handleNotificationChange('sms')}
                    />
                    <span>SMS Notifications</span>
                  </label>
                  <p className="toggle-description">Receive critical alerts via SMS</p>
                </div>
              </div>

              <div className="divider"></div>

              <div className="setting-group">
                <h3>Email Digest</h3>
                <p className="setting-description">How often would you like to receive summary emails?</p>

                <div className="digest-options">
                  {['daily', 'weekly', 'monthly', 'never'].map((option) => (
                    <button
                      key={option}
                      className={`digest-option ${preferences.emailDigest === option ? 'active' : ''}`}
                      onClick={() =>
                        setPreferences({
                          ...preferences,
                          emailDigest: option as Preferences['emailDigest'],
                        })
                      }
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider"></div>

              <div className="setting-group">
                <h3>Notification Types</h3>

                <div className="toggle-setting">
                  <input type="checkbox" defaultChecked />
                  <span>Alert Notifications</span>
                  <p className="toggle-description">Get notified when alerts are triggered</p>
                </div>

                <div className="toggle-setting">
                  <input type="checkbox" defaultChecked />
                  <span>System Updates</span>
                  <p className="toggle-description">Be notified about system updates</p>
                </div>

                <div className="toggle-setting">
                  <input type="checkbox" />
                  <span>Weekly Reports</span>
                  <p className="toggle-description">Receive weekly performance reports</p>
                </div>

                <div className="toggle-setting">
                  <input type="checkbox" />
                  <span>Maintenance Notices</span>
                  <p className="toggle-description">Get notified about scheduled maintenance</p>
                </div>
              </div>

              <button className="btn-save" style={{ marginTop: '1.5rem' }}>
                <UIIcon symbol="💾" /> Save Notification Settings
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="settings-section">
              <h2>Security Settings</h2>

              <div className="security-info">
                <div className="info-card">
                  <h3>Two-Factor Authentication</h3>
                  <div className="info-row">
                    <span>Status:</span>
                    <span className={security.twoFactorEnabled ? 'status-enabled' : 'status-disabled'}>
                      {security.twoFactorEnabled ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </div>
                  <button className="btn-secondary" style={{ marginTop: '1rem' }}>
                    {security.twoFactorEnabled ? <><UIIcon symbol="⚙️" /> Configure</> : <><UIIcon symbol="🔐" /> Enable 2FA</>}
                  </button>
                </div>

                <div className="info-card">
                  <h3>Password</h3>
                  <div className="info-row">
                    <span>Last Changed:</span>
                    <span>{security.lastPasswordChange}</span>
                  </div>
                  <button className="btn-secondary" style={{ marginTop: '1rem' }}>
                    <UIIcon symbol="🔑" /> Change Password
                  </button>
                </div>

                <div className="info-card">
                  <h3>Active Sessions</h3>
                  <div className="info-row">
                    <span>Active Devices:</span>
                    <span>{security.activeDevices}</span>
                  </div>
                  <button className="btn-secondary" style={{ marginTop: '1rem' }}>
                    <UIIcon symbol="📱" /> Manage Devices
                  </button>
                </div>

                <div className="info-card">
                  <h3>Login Security</h3>
                  <div className="info-row">
                    <span>Failed Attempts:</span>
                    <span>{security.loginAttempts}</span>
                  </div>
                  <button className="btn-secondary" style={{ marginTop: '1rem' }}>
                    <UIIcon symbol="🛡️" /> View Activity
                  </button>
                </div>
              </div>

              <div className="divider"></div>

              <div className="setting-group">
                <h3>Session Management</h3>

                <div className="session-list">
                  <div className="session-item">
                    <div className="session-info">
                      <span className="session-device"><UIIcon symbol="💻" /> Chrome on Windows</span>
                      <span className="session-location">San Francisco, CA</span>
                      <span className="session-time">Last active: 2 hours ago</span>
                    </div>
                    <span className="session-current">Current</span>
                  </div>

                  <div className="session-item">
                    <div className="session-info">
                      <span className="session-device"><UIIcon symbol="📱" /> Safari on iPhone</span>
                      <span className="session-location">San Francisco, CA</span>
                      <span className="session-time">Last active: 1 day ago</span>
                    </div>
                    <button className="btn-remove">Remove</button>
                  </div>

                  <div className="session-item">
                    <div className="session-info">
                      <span className="session-device"><UIIcon symbol="💻" /> Firefox on macOS</span>
                      <span className="session-location">San Francisco, CA</span>
                      <span className="session-time">Last active: 3 days ago</span>
                    </div>
                    <button className="btn-remove">Remove</button>
                  </div>
                </div>

                <button className="btn-danger" style={{ marginTop: '1rem' }}>
                  <UIIcon symbol="🚪" /> Logout All Other Sessions
                </button>
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="settings-section danger-zone">
              <h2>Danger Zone</h2>

              <div className="danger-card">
                <div className="danger-info">
                  <h3>Export Account Data</h3>
                  <p>Download all your data in a portable format (JSON, CSV)</p>
                </div>
                <button className="btn-warning"><UIIcon symbol="📥" /> Export Data</button>
              </div>

              <div className="danger-card">
                <div className="danger-info">
                  <h3>Deactivate Account</h3>
                  <p>Temporarily deactivate your account. You can reactivate anytime.</p>
                </div>
                <button className="btn-warning"><UIIcon symbol="⏸️" /> Deactivate</button>
              </div>

              <div className="danger-card critical">
                <div className="danger-info">
                  <h3>Delete Account</h3>
                  <p>
                    Permanently delete your account and all associated data. This action cannot be
                    undone.
                  </p>
                </div>
                <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                  <UIIcon symbol="🗑️" /> Delete Account
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="delete-confirmation">
                  <div className="confirmation-card">
                    <h3><UIIcon symbol="⚠️" /> Confirm Account Deletion</h3>
                    <p>
                      Are you sure you want to permanently delete your account? This action cannot
                      be undone and all your data will be lost.
                    </p>
                    <div className="confirmation-actions">
                      <button
                        className="btn-danger"
                        onClick={handleDeleteAccount}
                      >
                        Yes, Delete My Account
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
