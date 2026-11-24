import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './UserProfile.css';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar?: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  theme: 'light' | 'dark' | 'system';
  accountStatus: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
  mfaEnabled: boolean;
  passkeyEnabled: boolean;
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

interface LoginHistory {
  id: string;
  timestamp: string;
  device: string;
  location: string;
  ip: string;
  status: 'success' | 'failed';
  reason?: string;
}

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(
    'https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff'
  );

  const [profile, setProfile] = useState<UserProfileData>({
    id: '1',
    name: 'John Doe',
    email: 'john.doe@netmon.local',
    username: 'johndoe',
    avatar: avatar || undefined,
    timezone: 'America/Los_Angeles',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    theme: 'dark',
    accountStatus: 'active',
    lastLogin: '2026-09-20T07:10:00Z',
    createdAt: '2026-01-15T10:00:00Z',
    mfaEnabled: true,
    passkeyEnabled: false,
    notificationPreferences: {
      email: true,
      push: true,
      sms: false,
    },
  });

  const [editData, setEditData] = useState<UserProfileData>(profile);

  const [activeSessions] = useState<ActiveSession[]>([
    {
      id: '1',
      device: 'MacBook Pro',
      browser: 'Chrome 127.0',
      location: 'San Francisco, CA',
      ip: '203.0.113.42',
      lastActive: '2 minutes ago',
      isCurrent: true,
    },
    {
      id: '2',
      device: 'iPhone 15 Pro',
      browser: 'Safari',
      location: 'San Francisco, CA',
      ip: '203.0.113.85',
      lastActive: '1 hour ago',
      isCurrent: false,
    },
    {
      id: '3',
      device: 'Dell XPS 15',
      browser: 'Firefox 128.0',
      location: 'New York, NY',
      ip: '198.51.100.23',
      lastActive: '3 days ago',
      isCurrent: false,
    },
  ]);

  const [loginHistory] = useState<LoginHistory[]>([
    {
      id: '1',
      timestamp: '2026-09-20T07:10:00Z',
      device: 'MacBook Pro',
      location: 'San Francisco, CA',
      ip: '203.0.113.42',
      status: 'success',
    },
    {
      id: '2',
      timestamp: '2026-09-19T14:35:00Z',
      device: 'iPhone 15 Pro',
      location: 'San Francisco, CA',
      ip: '203.0.113.85',
      status: 'success',
    },
    {
      id: '3',
      timestamp: '2026-09-19T09:20:00Z',
      device: 'Dell XPS 15',
      location: 'New York, NY',
      ip: '198.51.100.23',
      status: 'success',
    },
    {
      id: '4',
      timestamp: '2026-09-18T22:15:00Z',
      device: 'Unknown',
      location: 'Moscow, Russia',
      ip: '192.0.2.100',
      status: 'failed',
      reason: 'Invalid credentials',
    },
  ]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setAvatar(imageUrl);
        setEditData({ ...editData, avatar: imageUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    setProfile(editData);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="user-profile-page">
      <div className="profile-header">
        <h1>User Profile</h1>
        <p className="profile-subtitle">Manage your account information and preferences</p>
      </div>

      <div className="profile-container">
        {/* Profile Card */}
        <div className="profile-card-main">
          <div className="profile-avatar-section">
            <div className="avatar-container">
              {avatar ? (
                <img src={avatar} alt="Profile" className="profile-avatar" />
              ) : (
                <div className="avatar-placeholder">
                  <span><UIIcon symbol="👤" /></span>
                </div>
              )}
            </div>

            {isEditing && (
              <label className="avatar-upload">
                <UIIcon symbol="📷" /> Change Avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </label>
            )}

            <div className="profile-name-section">
              <h2>{profile.name}</h2>
              <p className="profile-email">{profile.email}</p>
              <span className={`status-badge ${profile.accountStatus}`}>
                {profile.accountStatus === 'active' ? <><UIIcon symbol="🟢" /> Active</> :
                 profile.accountStatus === 'inactive' ? <><UIIcon symbol="🔴" /> Inactive</> :
                 <><UIIcon symbol="⚠️" /> Suspended</>}
              </span>
            </div>
          </div>

          {!isEditing ? (
            <button className="btn-edit" onClick={() => {
              setEditData(profile);
              setIsEditing(true);
            }}>
              <UIIcon symbol="✏️" /> Edit Profile
            </button>
          ) : (
            <div className="form-actions">
              <button className="btn-save" onClick={handleSaveProfile}>
                <UIIcon symbol="💾" /> Save Changes
              </button>
              <button className="btn-cancel" onClick={() => setIsEditing(false)}>
                <UIIcon symbol="❌" /> Cancel
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <UIIcon symbol="📋" /> Overview
          </button>
          <button
            className={`tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <UIIcon symbol="🔒" /> Security
          </button>
          <button
            className={`tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <UIIcon symbol="📱" /> Active Sessions
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <UIIcon symbol="📜" /> Login History
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="profile-section">
              <h3>Account Information</h3>

              {!isEditing ? (
                <div className="profile-info-grid">
                  <div className="info-item">
                    <label>Name</label>
                    <span>{profile.name}</span>
                  </div>
                  <div className="info-item">
                    <label>Username</label>
                    <span>{profile.username}</span>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <span>{profile.email}</span>
                  </div>
                  <div className="info-item">
                    <label>Account Status</label>
                    <span className={`status ${profile.accountStatus}`}>
                      {profile.accountStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Last Login</label>
                    <span>{formatDate(profile.lastLogin)}</span>
                  </div>
                  <div className="info-item">
                    <label>Account Created</label>
                    <span>{formatDate(profile.createdAt)}</span>
                  </div>
                </div>
              ) : (
                <div className="profile-form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              <h3 style={{ marginTop: '2rem' }}>Preferences</h3>

              {!isEditing ? (
                <div className="profile-info-grid">
                  <div className="info-item">
                    <label>Timezone</label>
                    <span>{profile.timezone}</span>
                  </div>
                  <div className="info-item">
                    <label>Language</label>
                    <span>{profile.language.toUpperCase()}</span>
                  </div>
                  <div className="info-item">
                    <label>Date Format</label>
                    <span>{profile.dateFormat}</span>
                  </div>
                  <div className="info-item">
                    <label>Time Format</label>
                    <span>{profile.timeFormat}</span>
                  </div>
                  <div className="info-item">
                    <label>Theme</label>
                    <span className="theme-badge">{profile.theme}</span>
                  </div>
                </div>
              ) : (
                <div className="profile-form">
                  <div className="form-group">
                    <label>Timezone</label>
                    <select
                      value={editData.timezone}
                      onChange={(e) => setEditData({ ...editData, timezone: e.target.value })}
                      className="form-input"
                    >
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="America/Chicago">America/Chicago (CST)</option>
                      <option value="America/Denver">America/Denver (MST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="UTC">UTC</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Language</label>
                    <select
                      value={editData.language}
                      onChange={(e) => setEditData({ ...editData, language: e.target.value })}
                      className="form-input"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="ja">日本語</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date Format</label>
                    <select
                      value={editData.dateFormat}
                      onChange={(e) => setEditData({ ...editData, dateFormat: e.target.value })}
                      className="form-input"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Time Format</label>
                    <select
                      value={editData.timeFormat}
                      onChange={(e) => setEditData({ ...editData, timeFormat: e.target.value })}
                      className="form-input"
                    >
                      <option value="12h">12-hour (AM/PM)</option>
                      <option value="24h">24-hour</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Theme</label>
                    <select
                      value={editData.theme}
                      onChange={(e) => setEditData({ ...editData, theme: e.target.value as any })}
                      className="form-input"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </div>
              )}

              <h3 style={{ marginTop: '2rem' }}>Notification Preferences</h3>

              <div className="notification-prefs">
                <div className="pref-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={profile.notificationPreferences.email}
                      readOnly
                    />
                    Email Notifications
                  </label>
                </div>
                <div className="pref-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={profile.notificationPreferences.push}
                      readOnly
                    />
                    Push Notifications
                  </label>
                </div>
                <div className="pref-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={profile.notificationPreferences.sms}
                      readOnly
                    />
                    SMS Notifications
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="profile-section">
              <h3>Security Settings</h3>

              <div className="security-cards">
                <div className="security-card">
                  <div className="security-info">
                    <h4>Two-Factor Authentication (2FA)</h4>
                    <p>
                      {profile.mfaEnabled
                        ? '✓ Enabled - Your account is protected with 2FA'
                        : '✗ Disabled - Enable 2FA for better security'}
                    </p>
                  </div>
                  <button className={`btn-security ${profile.mfaEnabled ? 'enabled' : ''}`}>
                    {profile.mfaEnabled ? <><UIIcon symbol="⚙️" /> Configure</> : <><UIIcon symbol="🔐" /> Enable</>}
                  </button>
                </div>

                <div className="security-card">
                  <div className="security-info">
                    <h4>Passkey Authentication</h4>
                    <p>
                      {profile.passkeyEnabled
                        ? '✓ Enabled - Use biometric or device authentication'
                        : '✗ Not set up - Enable for passwordless login'}
                    </p>
                  </div>
                  <button className={`btn-security ${profile.passkeyEnabled ? 'enabled' : ''}`}>
                    {profile.passkeyEnabled ? <><UIIcon symbol="⚙️" /> Manage</> : <><UIIcon symbol="🔑" /> Setup</>}
                  </button>
                </div>

                <div className="security-card">
                  <div className="security-info">
                    <h4>Password</h4>
                    <p>Last changed 3 weeks ago</p>
                  </div>
                  <button className="btn-security"><UIIcon symbol="🔑" /> Change Password</button>
                </div>
              </div>
            </div>
          )}

          {/* Active Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="profile-section">
              <h3>Active Sessions</h3>
              <p className="section-description">Manage your active sessions across devices</p>

              <div className="sessions-list">
                {activeSessions.map((session) => (
                  <div key={session.id} className="session-card">
                    <div className="session-badge">
                      {session.device.includes('Mac') ? <><UIIcon symbol="🍎" /></> :
                       session.device.includes('iPhone') ? <><UIIcon symbol="📱" /></> :
                       session.device.includes('Dell') ? <><UIIcon symbol="💻" /></> : <><UIIcon symbol="📱" /></>}
                    </div>

                    <div className="session-details">
                      <h4>{session.device}</h4>
                      <div className="session-meta">
                        <span>{session.browser}</span>
                        <span>•</span>
                        <span>{session.location}</span>
                      </div>
                      <p className="session-ip">{session.ip}</p>
                      <p className="session-time">Last active: {session.lastActive}</p>
                      {session.isCurrent && (
                        <span className="current-badge">Current Session</span>
                      )}
                    </div>

                    {!session.isCurrent && (
                      <button className="btn-terminate">Sign Out</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Login History Tab */}
          {activeTab === 'history' && (
            <div className="profile-section">
              <h3>Login History</h3>
              <p className="section-description">Recent login attempts to your account</p>

              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Device</th>
                      <th>Location</th>
                      <th>IP Address</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td className="time">{formatDate(entry.timestamp)}</td>
                        <td className="device">{entry.device}</td>
                        <td className="location">{entry.location}</td>
                        <td className="ip">{entry.ip}</td>
                        <td>
                          <span className={`status-badge ${entry.status}`}>
                            {entry.status === 'success' ? '✓ Success' : '✗ Failed'}
                            {entry.reason && ` - ${entry.reason}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
