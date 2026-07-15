import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLayout } from '../contexts/LayoutContext';
import { updateProfile, changePassword } from '../api/client';
import { 
  FaUser, FaEnvelope, FaLock, FaCircleCheck, 
  FaSpinner, FaShield, FaKey, FaIdCard, FaFloppyDisk,
  FaEye, FaEyeSlash, FaUserCheck, FaClock, FaCalendar,
  FaMedal, FaStar, FaBookOpen
} from 'react-icons/fa6';
import '../styles/Profile.css';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
};

export default function Profile() {
  const { user, refreshUser } = useLayout();

  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
  }, [user]);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);

    const trimmed = fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setProfileError('Full name must be between 2 and 100 characters');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(trimmed);
      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 10) {
      setPasswordError('Password must be at least 10 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'N/A';

  return (
    <motion.div 
      className="profile-page" 
      initial="initial" 
      animate="in" 
      variants={pageVariants} 
      transition={{ duration: 0.4 }}
    >
      <div className="profile-header">
        <div className="profile-header-content">
          <h1 className="profile-title">Profile Settings</h1>
          <p className="profile-subtitle">Manage your account information and security</p>
        </div>
        <div className="profile-avatar">
          <div className="avatar-circle">
            <FaUser className="avatar-icon" />
          </div>
          <div className="avatar-badge">
            <FaShield />
          </div>
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat-card">
          <div className="stat-icon" style={{ color: 'var(--clr-cyan)' }}>
            <FaUserCheck />
          </div>
          <div className="stat-value">{user?.full_name || 'User'}</div>
          <div className="stat-label">Account Name</div>
        </div>
        <div className="profile-stat-card">
          <div className="stat-icon" style={{ color: 'var(--clr-magenta)' }}>
            <FaMedal />
          </div>
          <div className="stat-value">{user?.badges_count || 0}</div>
          <div className="stat-label">Badges Earned</div>
        </div>
        <div className="profile-stat-card">
          <div className="stat-icon" style={{ color: 'var(--clr-orange)' }}>
            <FaStar />
          </div>
          <div className="stat-value">{user?.xp || 0}</div>
          <div className="stat-label">Total XP</div>
        </div>
        <div className="profile-stat-card">
          <div className="stat-icon" style={{ color: 'var(--clr-blue)' }}>
            <FaCalendar />
          </div>
          <div className="stat-value">{memberSince}</div>
          <div className="stat-label">Member Since</div>
        </div>
      </div>

      <div className="profile-grid">
        <motion.div 
          className="profile-card-wrapper"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <form onSubmit={handleProfileSubmit} className="profile-card">
            <div className="card-header">
              <h2 className="card-title">
                <FaIdCard className="card-icon" style={{ color: 'var(--clr-cyan)' }} />
                Personal Information
              </h2>
              <div className="card-badge">Edit</div>
            </div>

            <AnimatePresence>
              {profileError && (
                <motion.div 
                  className="alert alert-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <span className="alert-icon">⚠</span>
                  {profileError}
                </motion.div>
              )}
              {profileSuccess && (
                <motion.div 
                  className="alert alert-success"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <FaCircleCheck className="alert-icon" />
                  Profile updated successfully
                </motion.div>
              )}
            </AnimatePresence>

            <div className="form-group">
              <label className="form-label">
                <FaUser className="label-icon" style={{ color: 'var(--clr-cyan)' }} />
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                placeholder="Enter your full name"
                required
                disabled={savingProfile}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <FaEnvelope className="label-icon" style={{ color: 'var(--clr-blue)' }} />
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                className="form-input form-input-disabled"
                disabled
                readOnly
              />
              <span className="input-hint">Email cannot be changed</span>
            </div>

            <button 
              type="submit" 
              className="btn-primary btn-save"
              disabled={savingProfile}
            >
              {savingProfile ? (
                <>
                  <FaSpinner className="icon-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <FaFloppyDisk />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </motion.div>

        <motion.div 
          className="profile-card-wrapper"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <form onSubmit={handlePasswordSubmit} className="profile-card">
            <div className="card-header">
              <h2 className="card-title">
                <FaKey className="card-icon" style={{ color: 'var(--clr-magenta)' }} />
                Security
              </h2>
              <div className="card-badge card-badge-security">Protected</div>
            </div>

            <AnimatePresence>
              {passwordError && (
                <motion.div 
                  className="alert alert-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <span className="alert-icon">⚠</span>
                  {passwordError}
                </motion.div>
              )}
              {passwordSuccess && (
                <motion.div 
                  className="alert alert-success"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <FaCircleCheck className="alert-icon" />
                  Password changed successfully
                </motion.div>
              )}
            </AnimatePresence>

            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter current password"
                  required
                  disabled={savingPassword}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('current')}
                  disabled={savingPassword}
                >
                  {showPassword.current ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter new password"
                  required
                  disabled={savingPassword}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('new')}
                  disabled={savingPassword}
                >
                  {showPassword.new ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <span className="input-hint">Minimum 10 characters for security</span>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="Confirm new password"
                  required
                  disabled={savingPassword}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('confirm')}
                  disabled={savingPassword}
                >
                  {showPassword.confirm ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary btn-security"
              disabled={savingPassword}
            >
              {savingPassword ? (
                <>
                  <FaSpinner className="icon-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <FaLock />
                  Update Password
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
} 
