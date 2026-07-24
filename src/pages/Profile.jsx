 import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLayout } from '../contexts/LayoutContext';
import { updateProfile, changePassword, requestLevelChange, getProfile } from '../api/client';
import {
  FaUser, FaEnvelope, FaLock, FaCircleCheck,
  FaSpinner, FaShield, FaKey, FaIdCard, FaFloppyDisk,
  FaEye, FaEyeSlash, FaUserCheck, FaCalendar,
  FaMedal, FaStar, FaArrowRightArrowLeft, FaGraduationCap,
  FaClock
} from 'react-icons/fa6';
import { ProfilePictureUpload } from '../components/ProfilePictureUpload';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
};

const TRACK_RING_COLOR = {
  'O-Level': 'var(--clr-cyan)',
  'A-Level': 'var(--clr-magenta)',
  'Pharmacy': 'var(--clr-green)'
};

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Weak', color: 'var(--clr-red)' };
  if (score <= 3) return { score: 2, label: 'Fair', color: 'var(--clr-orange)' };
  return { score: 3, label: 'Strong', color: 'var(--clr-green)' };
}

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

  const [changeRequestClass, setChangeRequestClass] = useState('');
  const [changeRequestReason, setChangeRequestReason] = useState('');
  const [changeRequestLoading, setChangeRequestLoading] = useState(false);
  const [changeRequestMessage, setChangeRequestMessage] = useState('');

  const [profileMeta, setProfileMeta] = useState(null);
  const [profileMetaError, setProfileMetaError] = useState('');

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfileMeta() {
      try {
        const data = await getProfile();
        if (!cancelled) {
          setProfileMeta(data);
          setProfileMetaError('');
        }
      } catch (err) {
        if (!cancelled) setProfileMetaError(err.message || 'Failed to load profile details');
      }
    }
    if (user) loadProfileMeta();
    return () => { cancelled = true; };
  }, [user]);

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

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

  async function handleRequestLevelChange(e) {
    e.preventDefault();
    setChangeRequestLoading(true);
    setChangeRequestMessage('');
    try {
      await requestLevelChange(profileMeta?.track, changeRequestClass, changeRequestReason);
      setChangeRequestMessage('Request submitted for admin review.');
      setChangeRequestClass('');
      setChangeRequestReason('');
    } catch (err) {
      setChangeRequestMessage(err.message || 'Failed to submit request.');
    } finally {
      setChangeRequestLoading(false);
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

  const currentLevel = profileMeta?.level_display_name || profileMeta?.track || 'Not set';
  const currentClass = profileMeta?.class_name || 'Not set';
  const classLabel = profileMeta?.class_label || 'Class';
  const classOptions = profileMeta?.class_options || [];
  const ringColor = TRACK_RING_COLOR[profileMeta?.track] || 'var(--clr-blue)';
  const isTeacher = profileMeta?.role === 'teacher';

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

          <div className="profile-identity-chips">
            <span className="chip chip-cyan">{profileMeta?.role || 'student'}</span>
            {profileMeta?.track && <span className="chip chip-magenta">{profileMeta.track}</span>}
            {profileMeta?.class_name && <span className="chip chip-blue">{profileMeta.class_name}</span>}
            {isTeacher && (
              <span className={`chip ${profileMeta?.is_approved_teacher ? 'chip-green' : 'chip-orange'}`}>
                {profileMeta?.is_approved_teacher ? <FaCircleCheck /> : <FaClock />}
                {profileMeta?.is_approved_teacher ? 'Approved Teacher' : 'Pending Approval'}
              </span>
            )}
          </div>
        </div>
        <div className="profile-avatar-ring" style={{ borderColor: ringColor }}>
          <ProfilePictureUpload
            currentUrl={user?.profile?.profile_picture_url}
            onUpdate={(url) => {
              refreshUser();
            }}
            size={80}
          />
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat-card profile-stat-card--cyan">
          <div className="stat-icon" style={{ color: 'var(--clr-cyan)' }}>
            <FaUserCheck />
          </div>
          <div className="stat-value">{user?.full_name || 'User'}</div>
          <div className="stat-label">Account Name</div>
        </div>
        <div className="profile-stat-card profile-stat-card--purple">
          <div className="stat-icon" style={{ color: 'var(--clr-purple)' }}>
            <FaMedal />
          </div>
          <div className="stat-value">{user?.badges_count || 0}</div>
          <div className="stat-label">Badges Earned</div>
        </div>
        <div className="profile-stat-card profile-stat-card--orange">
          <div className="stat-icon" style={{ color: 'var(--clr-orange)' }}>
            <FaStar />
          </div>
          <div className="stat-value">{user?.xp || 0}</div>
          <div className="stat-label">Total XP</div>
        </div>
        <div className="profile-stat-card profile-stat-card--blue">
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
          <form onSubmit={handleProfileSubmit} className="profile-card profile-card--cyan">
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
          <form onSubmit={handlePasswordSubmit} className="profile-card profile-card--magenta">
            <div className="card-header">
              <h2 className="card-title">
                <FaKey className="card-icon" style={{ color: 'var(--clr-magenta)' }} />
                Security
              </h2>
              <div className="card-badge card-badge-security">
                <FaShield />
                Protected
              </div>
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
              {newPassword && (
                <div className="password-strength-meter">
                  <div className="password-strength-track">
                    <div
                      className="password-strength-fill"
                      style={{ width: `${(passwordStrength.score / 3) * 100}%`, background: passwordStrength.color }}
                    />
                  </div>
                  <span className="password-strength-label" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
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

        <motion.div
          className="profile-card-wrapper"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="profile-card profile-card--green">
            <div className="card-header">
              <h2 className="card-title">
                <FaGraduationCap className="card-icon" style={{ color: 'var(--clr-green)' }} />
                Current {classLabel}
              </h2>
              <div className="card-badge">{profileMeta?.track || '—'}</div>
            </div>

            {profileMetaError && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠</span>
                {profileMetaError}
              </div>
            )}

            <div className="profile-level-info">
              <div className="profile-info-row">
                <span className="profile-info-label">Level</span>
                <span className="profile-info-value">{currentLevel}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Current {classLabel}</span>
                <span className="profile-info-value">{currentClass}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Available {classLabel}s</span>
                <span className="profile-info-value">{classOptions.join(', ') || '—'}</span>
              </div>
            </div>

            <div className="profile-divider"></div>

            <div className="profile-change-section">
              <h3 className="profile-change-title">
                <FaArrowRightArrowLeft style={{ color: 'var(--clr-orange)' }} />
                Request {classLabel} Change
              </h3>
              <p className="profile-change-hint">
                Submit a request to change your {classLabel.toLowerCase()}.
                An admin will review and approve it.
              </p>

              <form onSubmit={handleRequestLevelChange} className="profile-change-form">
                <div className="form-group">
                  <label className="form-label">New {classLabel}</label>
                  <select
                    value={changeRequestClass}
                    onChange={e => setChangeRequestClass(e.target.value)}
                    className="form-input"
                    required
                    disabled={classOptions.length === 0}
                  >
                    <option value="">Select {classLabel}</option>
                    {classOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Change</label>
                  <textarea
                    value={changeRequestReason}
                    onChange={e => setChangeRequestReason(e.target.value)}
                    className="form-input"
                    rows="3"
                    placeholder="Why do you want to change your class?"
                    required
                  />
                </div>

                {changeRequestMessage && (
                  <div className={`alert ${changeRequestMessage.includes('submitted') ? 'alert-success' : 'alert-error'}`}>
                    {changeRequestMessage}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary profile-change-btn"
                  disabled={changeRequestLoading || !changeRequestClass}
                >
                  {changeRequestLoading ? (
                    <>
                      <FaSpinner className="icon-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <FaArrowRightArrowLeft /> Request {classLabel} Change
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
