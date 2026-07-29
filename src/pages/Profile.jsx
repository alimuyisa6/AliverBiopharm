 import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLayout } from '../contexts/LayoutContext';
import { updateProfile, changePassword, updateClass, requestLevelChange, getProfile, getClassSequence, getPharmacyPrograms } from '../api/client';
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

const TRACKS = ['O-Level', 'A-Level', 'Pharmacy'];

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', colorClass: '' };
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Weak', colorClass: 'strength-weak' };
  if (score <= 3) return { score: 2, label: 'Fair', colorClass: 'strength-fair' };
  return { score: 3, label: 'Strong', colorClass: 'strength-strong' };
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

  const [newClass, setNewClass] = useState('');
  const [classSaving, setClassSaving] = useState(false);
  const [classMessage, setClassMessage] = useState('');

  const [levelReqTrack, setLevelReqTrack] = useState('');
  const [levelReqClasses, setLevelReqClasses] = useState([]);
  const [levelReqClass, setLevelReqClass] = useState('');
  const [levelReqReason, setLevelReqReason] = useState('');
  const [levelReqLoading, setLevelReqLoading] = useState(false);
  const [levelReqMessage, setLevelReqMessage] = useState('');

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

  useEffect(() => {
    if (!levelReqTrack) {
      setLevelReqClasses([]);
      return;
    }
    setLevelReqClass('');
    if (levelReqTrack === 'Pharmacy') {
      getPharmacyPrograms()
        .then(data => setLevelReqClasses((data || []).map(p => p.program_name)))
        .catch(() => setLevelReqClasses([]));
    } else {
      getClassSequence(levelReqTrack)
        .then(data => setLevelReqClasses((data || []).map(c => c.class_name)))
        .catch(() => setLevelReqClasses([]));
    }
  }, [levelReqTrack]);

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

  async function handleClassSubmit(e) {
    e.preventDefault();
    setClassSaving(true);
    setClassMessage('');
    try {
      await updateClass(newClass);
      const refreshed = await getProfile();
      setProfileMeta(refreshed);
      setClassMessage('Class updated.');
      setNewClass('');
    } catch (err) {
      setClassMessage(err.message || 'Failed to update class.');
    } finally {
      setClassSaving(false);
    }
  }

  async function handleRequestLevelChange(e) {
    e.preventDefault();
    setLevelReqLoading(true);
    setLevelReqMessage('');
    try {
      await requestLevelChange(levelReqTrack, levelReqClass, levelReqReason);
      setLevelReqMessage('Request submitted for admin review.');
      setLevelReqTrack('');
      setLevelReqClass('');
      setLevelReqReason('');
    } catch (err) {
      setLevelReqMessage(err.message || 'Failed to submit request.');
    } finally {
      setLevelReqLoading(false);
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
  const classOptions = (profileMeta?.class_options || []).filter(c => c !== currentClass);
  const isTeacher = profileMeta?.role === 'teacher';

  const trackRingClass = profileMeta?.track
    ? (profileMeta.track === 'O-Level' ? 'profile-ring-olevel' : profileMeta.track === 'A-Level' ? 'profile-ring-alevel' : 'profile-ring-pharmacy')
    : 'profile-ring-blue';

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
            {isTeacher && profileMeta?.approved_track === 'ALL' && (
              <span className="chip chip-green">All Levels Access</span>
            )}
          </div>
        </div>
        <div className={`profile-avatar-ring ${trackRingClass}`}>
          <ProfilePictureUpload
            currentUrl={user?.profile?.profile_picture_url}
            onUpdate={() => refreshUser()}
            size={80}
          />
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat-card profile-stat-card--cyan">
          <div className="stat-icon stat-icon-cyan">
            <FaUserCheck />
          </div>
          <div className="stat-value">{user?.full_name || 'User'}</div>
          <div className="stat-label">Account Name</div>
        </div>
        <div className="profile-stat-card profile-stat-card--purple">
          <div className="stat-icon stat-icon-purple">
            <FaMedal />
          </div>
          <div className="stat-value">{user?.badges_count || 0}</div>
          <div className="stat-label">Badges Earned</div>
        </div>
        <div className="profile-stat-card profile-stat-card--orange">
          <div className="stat-icon stat-icon-orange">
            <FaStar />
          </div>
          <div className="stat-value">{user?.xp || 0}</div>
          <div className="stat-label">Total XP</div>
        </div>
        <div className="profile-stat-card profile-stat-card--blue">
          <div className="stat-icon stat-icon-blue">
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
                <FaIdCard className="card-icon card-icon-cyan" />
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
                <FaUser className="label-icon label-icon-cyan" />
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
                <FaEnvelope className="label-icon label-icon-blue" />
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
                <FaKey className="card-icon card-icon-magenta" />
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
                      className={`password-strength-fill ${passwordStrength.colorClass}`}
                      style={{ '--strength-width': `${(passwordStrength.score / 3) * 100}%` }}
                    />
                  </div>
                  <span className={`password-strength-label ${passwordStrength.colorClass}`}>
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
                <FaGraduationCap className="card-icon card-icon-green" />
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
            </div>

            {!isTeacher || (isTeacher && profileMeta?.approved_track !== 'ALL') ? (
              <>
                <div className="profile-divider"></div>

                <div className="profile-change-section">
                  <h3 className="profile-change-title">
                    <FaArrowRightArrowLeft className="label-icon label-icon-cyan" />
                    Change {classLabel}
                  </h3>
                  <p className="profile-change-hint">
                    Switch to another {classLabel.toLowerCase()} within your current level. This takes effect immediately.
                  </p>

                  <form onSubmit={handleClassSubmit} className="profile-change-form">
                    <div className="form-group">
                      <label className="form-label">New {classLabel}</label>
                      <select
                        value={newClass}
                        onChange={e => setNewClass(e.target.value)}
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

                    {classMessage && (
                      <div className={`alert ${classMessage.includes('updated') ? 'alert-success' : 'alert-error'}`}>
                        {classMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn-primary profile-change-btn"
                      disabled={classSaving || !newClass}
                    >
                      {classSaving ? (
                        <>
                          <FaSpinner className="icon-spin" /> Updating...
                        </>
                      ) : (
                        <>
                          <FaArrowRightArrowLeft /> Update {classLabel}
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : null}

            {!isTeacher && (
              <>
                <div className="profile-divider"></div>

                <div className="profile-change-section">
                  <h3 className="profile-change-title">
                    <FaArrowRightArrowLeft className="label-icon label-icon-orange" />
                    Request Level Change
                  </h3>
                  <p className="profile-change-hint">
                    Moving to a different level (O-Level, A-Level, Pharmacy) requires admin approval.
                  </p>

                  <form onSubmit={handleRequestLevelChange} className="profile-change-form">
                    <div className="form-group">
                      <label className="form-label">New Level</label>
                      <select
                        value={levelReqTrack}
                        onChange={e => setLevelReqTrack(e.target.value)}
                        className="form-input"
                        required
                      >
                        <option value="">Select Level</option>
                        {TRACKS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">New Class/Programme</label>
                      <select
                        value={levelReqClass}
                        onChange={e => setLevelReqClass(e.target.value)}
                        className="form-input"
                        required
                        disabled={levelReqClasses.length === 0}
                      >
                        <option value="">Select Class</option>
                        {levelReqClasses.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Reason for Change</label>
                      <textarea
                        value={levelReqReason}
                        onChange={e => setLevelReqReason(e.target.value)}
                        className="form-input"
                        rows="3"
                        placeholder="Why do you want to change your level?"
                        required
                      />
                    </div>

                    {levelReqMessage && (
                      <div className={`alert ${levelReqMessage.includes('submitted') ? 'alert-success' : 'alert-error'}`}>
                        {levelReqMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn-primary profile-change-btn"
                      disabled={levelReqLoading || !levelReqTrack || !levelReqClass}
                    >
                      {levelReqLoading ? (
                        <>
                          <FaSpinner className="icon-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <FaArrowRightArrowLeft /> Request Level Change
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
