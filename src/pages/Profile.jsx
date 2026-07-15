import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLayout } from '../contexts/LayoutContext';
import { updateProfile, changePassword } from '../api/client';
import { FaUser, FaEnvelope, FaLock, FaFloppyDisk, FaCheck, FaSpinner } from 'react-icons/fa6';
import '../styles/Dashboard.css';

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

  return (
    <motion.div className="profile-page section" initial="initial" animate="in" variants={pageVariants} transition={{ duration: 0.3 }}>
      <div className="dashboard-header">
        <h1 className="section-title">Profile</h1>
        <p className="section-subtitle">Manage your account details</p>
      </div>

      <div className="profile-grid">
        <form onSubmit={handleProfileSubmit} className="card profile-card">
          <h2 className="profile-card-title"><FaUser style={{ color: 'var(--clr-cyan)' }} /> Personal information</h2>

          {profileError && <div className="alert alert-error">{profileError}</div>}
          {profileSuccess && <div className="alert alert-success"><FaCheck /> Profile updated</div>}

          <div>
            <label className="f-label">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input"
              required
              disabled={savingProfile}
            />
          </div>

          <div>
            <label className="f-label"><FaEnvelope /> Email</label>
            <input
              type="email"
              value={user?.email || ''}
              className="form-input"
              disabled
              readOnly
            />
          </div>

          <button type="submit" className="btn-primary" disabled={savingProfile}>
            {savingProfile ? <><FaSpinner className="icon-spin" /> Saving...</> : <><FaFloppyDisk style={{ marginRight: '8px' }} /> Save changes</>}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="card profile-card">
          <h2 className="profile-card-title"><FaLock style={{ color: 'var(--clr-magenta)' }} /> Change password</h2>

          {passwordError && <div className="alert alert-error">{passwordError}</div>}
          {passwordSuccess && <div className="alert alert-success"><FaCheck /> Password changed</div>}

          <div>
            <label className="f-label">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="form-input"
              required
              disabled={savingPassword}
            />
          </div>

          <div>
            <label className="f-label">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
              required
              disabled={savingPassword}
            />
          </div>

          <div>
            <label className="f-label">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              required
              disabled={savingPassword}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={savingPassword}>
            {savingPassword ? <><FaSpinner className="icon-spin" /> Updating...</> : <><FaLock style={{ marginRight: '8px' }} /> Update password</>}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
