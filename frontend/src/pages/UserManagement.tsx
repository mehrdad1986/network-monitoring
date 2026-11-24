import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './UserManagement.css';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  lastLogin: string;
  created: string;
  twoFactor: boolean;
  permissions: string[];
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  permissions: string[];
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [showAddUser, setShowAddUser] = useState(false);

  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      username: 'admin',
      email: 'admin@netmon.local',
      fullName: 'Administrator',
      role: 'admin',
      status: 'active',
      lastLogin: '2026-09-20 06:35:00',
      created: '2026-01-15 10:00:00',
      twoFactor: true,
      permissions: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
    },
    {
      id: '2',
      username: 'operator',
      email: 'operator@netmon.local',
      fullName: 'Network Operator',
      role: 'operator',
      status: 'active',
      lastLogin: '2026-09-20 05:15:00',
      created: '2026-02-20 14:30:00',
      twoFactor: true,
      permissions: ['read', 'write', 'manage_network'],
    },
    {
      id: '3',
      username: 'monitor',
      email: 'monitor@netmon.local',
      fullName: 'Monitoring User',
      role: 'viewer',
      status: 'active',
      lastLogin: '2026-09-20 06:25:00',
      created: '2026-03-10 09:00:00',
      twoFactor: false,
      permissions: ['read', 'view_reports'],
    },
    {
      id: '4',
      username: 'backup_admin',
      email: 'backup@netmon.local',
      fullName: 'Backup Administrator',
      role: 'admin',
      status: 'inactive',
      lastLogin: '2026-09-10 12:00:00',
      created: '2026-04-05 11:00:00',
      twoFactor: true,
      permissions: ['read', 'write', 'delete', 'manage_backup'],
    },
  ]);

  const [groups, setGroups] = useState<Group[]>([
    {
      id: 'admin_group',
      name: 'Administrators',
      description: 'Full system access',
      members: 2,
      permissions: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
    },
    {
      id: 'operators',
      name: 'Network Operators',
      description: 'Network management access',
      members: 5,
      permissions: ['read', 'write', 'manage_network'],
    },
    {
      id: 'viewers',
      name: 'Viewers',
      description: 'Read-only access',
      members: 12,
      permissions: ['read', 'view_reports'],
    },
  ]);

  const roleColors = {
    admin: '#ef4444',
    operator: '#f59e0b',
    viewer: '#3b82f6',
  };

  return (
    <div className="user-management">
      <div className="user-header">
        <h1>User Management</h1>
        <p className="user-subtitle">Manage users, groups, and permissions</p>
      </div>

      <div className="user-stats">
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="👥" /></div>
          <div className="stat-content">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{users.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-label">Active Users</div>
            <div className="stat-value">{users.filter(u => u.status === 'active').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="👨‍💼" /></div>
          <div className="stat-content">
            <div className="stat-label">Groups</div>
            <div className="stat-value">{groups.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><UIIcon symbol="🔐" /></div>
          <div className="stat-content">
            <div className="stat-label">2FA Enabled</div>
            <div className="stat-value">{users.filter(u => u.twoFactor).length}</div>
          </div>
        </div>
      </div>

      <div className="user-tabs">
        <button
          className={`user-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <UIIcon symbol="👤" /> Users
        </button>
        <button
          className={`user-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <UIIcon symbol="👥" /> Groups
        </button>
        <button
          className={`user-tab ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          <UIIcon symbol="🔐" /> Permissions
        </button>
      </div>

      <div className="user-content">
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="user-section">
            <div className="users-header">
              <h3>Users</h3>
              <button className="add-btn" onClick={() => setShowAddUser(!showAddUser)}>
                + Add User
              </button>
            </div>

            {showAddUser && (
              <div className="add-user-form">
                <div className="form-row">
                  <input type="text" placeholder="Username" className="form-input" />
                  <input type="email" placeholder="Email" className="form-input" />
                </div>
                <div className="form-row">
                  <input type="text" placeholder="Full Name" className="form-input" />
                  <select className="form-input">
                    <option>Admin</option>
                    <option>Operator</option>
                    <option>Viewer</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button className="btn-primary">Create User</button>
                  <button className="btn-secondary" onClick={() => setShowAddUser(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>2FA</th>
                    <th>Last Login</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className={`user-row ${user.status}`}>
                      <td className="username">{user.username}</td>
                      <td>{user.fullName}</td>
                      <td className="email">{user.email}</td>
                      <td>
                        <span className="role-badge" style={{ color: roleColors[user.role] }}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.status}`}>
                          {user.status === 'active' ? <><UIIcon symbol="🟢" /> Active</> : user.status === 'inactive' ? <><UIIcon symbol="🔴" /> Inactive</> : <><UIIcon symbol="🔒" /> Locked</>}
                        </span>
                      </td>
                      <td className="twofa">
                        {user.twoFactor ? '✓ Enabled' : '✗ Disabled'}
                      </td>
                      <td className="timestamp">{user.lastLogin}</td>
                      <td className="timestamp">{user.created}</td>
                      <td className="actions">
                        <button className="action-icon" title="Edit"><UIIcon symbol="✏️" /></button>
                        <button className="action-icon" title="Reset Password"><UIIcon symbol="🔑" /></button>
                        <button className="action-icon" title="Delete"><UIIcon symbol="🗑️" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="user-section">
            <div className="groups-header">
              <h3>User Groups</h3>
              <button className="add-btn">+ Create Group</button>
            </div>
            <div className="groups-grid">
              {groups.map(group => (
                <div key={group.id} className="group-card">
                  <div className="group-header">
                    <h4>{group.name}</h4>
                    <span className="member-count">{group.members} members</span>
                  </div>
                  <p className="group-description">{group.description}</p>
                  <div className="group-permissions">
                    <strong>Permissions:</strong>
                    <div className="permissions-list">
                      {group.permissions.map((perm, idx) => (
                        <span key={idx} className="perm-badge">{perm}</span>
                      ))}
                    </div>
                  </div>
                  <div className="group-actions">
                    <button className="action-btn">Edit</button>
                    <button className="action-btn">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="user-section">
            <div className="permissions-container">
              <h3>Permissions Matrix</h3>
              <div className="permissions-matrix">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Permission</th>
                      <th>Admin</th>
                      <th>Operator</th>
                      <th>Viewer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'View Dashboard', admin: true, operator: true, viewer: true },
                      { name: 'View Reports', admin: true, operator: true, viewer: true },
                      { name: 'Configure System', admin: true, operator: false, viewer: false },
                      { name: 'Manage Users', admin: true, operator: false, viewer: false },
                      { name: 'Edit Firewall', admin: true, operator: true, viewer: false },
                      { name: 'Manage Services', admin: true, operator: true, viewer: false },
                      { name: 'View Logs', admin: true, operator: true, viewer: true },
                      { name: 'Export Data', admin: true, operator: true, viewer: false },
                      { name: 'Manage ISPs', admin: true, operator: true, viewer: false },
                      { name: 'System Backup', admin: true, operator: false, viewer: false },
                    ].map((perm, idx) => (
                      <tr key={idx}>
                        <td className="perm-name">{perm.name}</td>
                        <td className="perm-check">{perm.admin ? '✓' : '✗'}</td>
                        <td className="perm-check">{perm.operator ? '✓' : '✗'}</td>
                        <td className="perm-check">{perm.viewer ? '✓' : '✗'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
