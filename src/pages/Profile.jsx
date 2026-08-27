/* pages/Profile.jsx */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import {
  updateProfile,
  changePassword,
  requestLevelChange,
  getProfile,
  getCurriculumLevels,
  updateDisplayName,
  getClassSequence,
  getDevices,
  revokeSession,
  getNotificationSettings,
  saveNotificationSettings
} from '../api/client';
import PageHeader from '../components/PageHeader/PageHeader';
import Container from '../components/Container/Container';
import Input from '../components/Input/Input';
import Button from '../components/Button/Button';
import ProfilePictureUpload from '../components/ProfilePictureUpload/ProfilePictureUpload';
import Spinner from '../components/Spinner/Spinner';
import Skeleton from '../components/Skeleton/Skeleton';
import Card from '../components/Card/Card';
import Icon from '../components/Icon/Icon';
import { useToast } from '../components/Toast/Toast';

const NOTIFICATION_MODULE_LABELS = {
  auth: 'Account & Security',
  recall: 'Recall Reminders',
  quiz: 'Quizzes',
  resources: 'Resources',
  pdfs: 'PDF Downloads',
  notes: 'Notes',
  flashcards: 'Flashcards',
  glossary: 'Glossary',
  past_papers: 'Past Papers',
  social: 'Social',
  community: 'Community',
  system: 'System Updates',
  payment: 'Billing',
  chat: 'Chat'
};

function formatDate(value) {
  if (!value) return '\u2014';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const { level } = useLayout();
  const addToast = useToast();

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [levelReqTrack, setLevelReqTrack] = useState('');
  const [levelReqClass, setLevelReqClass] = useState('');
  const [levelReqReason, setLevelReqReason] = useState('');
  const [levelReqLoading, setLevelReqLoading] = useState(false);

  const [profileMeta, setProfileMeta] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [availableLevels, setAvailableLevels] = useState([]);
  const [availableLevelsLoading, setAvailableLevelsLoading] = useState(false);

  const [levelReqClasses, setLevelReqClasses] = useState([]);
  const [levelReqClassesLoading, setLevelReqClassesLoading] = useState(false);

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  const [notificationPrefs, setNotificationPrefs] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (user?.profile?.display_name) setDisplayName(user.profile.display_name);
  }, [user]);

  useEffect(() => {
    setProfileLoading(true);
    getProfile()
      .then(setProfileMeta)
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [user]);

  useEffect(() => {
    setDevicesLoading(true);
    getDevices()
      .then(data => setDevices(data || []))
      .catch(() => {})
      .finally(() => setDevicesLoading(false));
  }, []);

  useEffect(() => {
    setNotificationsLoading(true);
    getNotificationSettings()
      .then(data => setNotificationPrefs(data || []))
      .catch(() => {})
      .finally(() => setNotificationsLoading(false));
  }, []);

  useEffect(() => {
    if (!profileMeta || profileMeta.role === 'teacher' || availableLevels.length || availableLevelsLoading) return;
    setAvailableLevelsLoading(true);
    getCurriculumLevels()
      .then(data => setAvailableLevels(data || []))
      .catch(() => {})
      .finally(() => setAvailableLevelsLoading(false));
  }, [profileMeta, availableLevels.length, availableLevelsLoading]);

  useEffect(() => {
    setLevelReqClass('');
    if (!levelReqTrack) {
      setLevelReqClasses([]);
      return;
    }
    setLevelReqClassesLoading(true);
    getClassSequence(levelReqTrack)
      .then(data => setLevelReqClasses(data || []))
      .catch(() => setLevelReqClasses([]))
      .finally(() => setLevelReqClassesLoading(false));
  }, [levelReqTrack]);

  const levelChangeOptions = useMemo(
    () => availableLevels.filter(lvl => lvl.display_name !== profileMeta?.track),
    [availableLevels, profileMeta]
  );

  const pendingLevelChange = useMemo(() => {
    const status = profileMeta?.level_change_status;
    if (!status) return null;
    return status.status === 'pending' ? status : null;
  }, [profileMeta]);

  const resolvedLevelChange = useMemo(() => {
    const status = profileMeta?.level_change_status;
    if (!status) return null;
    return status.status !== 'pending' ? status : null;
  }, [profileMeta]);

  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 10) score++;
    if (newPassword.length >= 14) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    if (score <= 2) return { score: 1, label: 'Weak', color: 'var(--error)' };
    if (score <= 3) return { score: 2, label: 'Fair', color: 'var(--warning)' };
    return { score: 3, label: 'Strong', color: 'var(--success)' };
  }, [newPassword]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const trimmed = fullName.trim();
    const trimmedDisplayName = displayName.trim();

    if (trimmed.length < 2 || trimmed.length > 100) {
      addToast('Name must be between 2 and 100 characters', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(trimmed);
      if (trimmedDisplayName && trimmedDisplayName.length >= 2) {
        await updateDisplayName(trimmedDisplayName);
      }
      await refresh();
      addToast('Profile updated', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { addToast('Passwords do not match', 'error'); return; }
    if (newPassword.length < 10) { addToast('Password must be at least 10 characters', 'error'); return; }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('Password changed', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to change password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLevelChangeRequest = async (e) => {
    e.preventDefault();
    if (!levelReqTrack || !levelReqClass || !levelReqReason.trim()) { addToast('Please complete all fields', 'error'); return; }
    setLevelReqLoading(true);
    try {
      await requestLevelChange(levelReqTrack, levelReqClass, levelReqReason);
      setLevelReqTrack('');
      setLevelReqClass('');
      setLevelReqReason('');
      const updated = await getProfile().catch(() => null);
      if (updated) setProfileMeta(updated);
      addToast('Level change request submitted', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to submit request', 'error');
    } finally {
      setLevelReqLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    setRevokingSessionId(sessionId);
    try {
      await revokeSession(sessionId);
      setDevices(prev => prev.filter(d => d.id !== sessionId));
      addToast('Session revoked', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to revoke session', 'error');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleNotificationToggle = (moduleName, channel) => {
    setNotificationPrefs(prev =>
      prev.map(pref =>
        pref.module === moduleName
          ? { ...pref, [channel]: !pref[channel] }
          : pref
      )
    );
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const saved = await saveNotificationSettings(notificationPrefs);
      setNotificationPrefs(saved || notificationPrefs);
      addToast('Notification preferences saved', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save notification preferences', 'error');
    } finally {
      setSavingNotifications(false);
    }
  };

  if (profileLoading) {
    return (
      <Container>
        <PageHeader title="Profile Settings" subtitle="Manage your account and security" />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-10)' }}>
          <Skeleton variant="avatar" width={96} height={96} />
        </div>
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-10)' }}>
          <Card variant="inset" loading={true} loadingLines={4} />
          <Card variant="inset" loading={true} loadingLines={4} />
        </div>
      </Container>
    );
  }

  const xp = profileMeta?.xp;
  const platformStats = profileMeta?.platform_stats;

  return (
    <Container>
      <PageHeader title="Profile Settings" subtitle="Manage your account and security" />

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-10)' }}>
        <ProfilePictureUpload
          currentUrl={user?.profile?.profile_picture_url}
          onUpdate={() => refresh()}
          size={96}
        />
      </div>

      {(xp || platformStats) && (
        <Card variant="curved" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-10)' }}>
          <h3 className="font-poppins" style={{ marginBottom: 'var(--space-6)' }}><Icon name="fire" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />Progress</h3>
          <div className="grid grid-cols-4" style={{ gap: 'var(--space-6)' }}>
            <div>
              <span className="font-source-sans" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>Total XP</span>
              <p className="font-poppins" style={{ fontSize: 'var(--text-xl)' }}>{platformStats?.total_xp ?? xp?.total_xp ?? 0}</p>
            </div>
            <div>
              <span className="font-source-sans" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>Level</span>
              <p className="font-poppins" style={{ fontSize: 'var(--text-xl)' }}>{platformStats?.platform_level ?? xp?.level ?? '\u2014'}</p>
            </div>
            <div>
              <span className="font-source-sans" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>Current Streak</span>
              <p className="font-poppins" style={{ fontSize: 'var(--text-xl)' }}>{platformStats?.current_streak ?? 0} days</p>
            </div>
            <div>
              <span className="font-source-sans" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>Longest Streak</span>
              <p className="font-poppins" style={{ fontSize: 'var(--text-xl)' }}>{platformStats?.longest_streak ?? 0} days</p>
            </div>
          </div>
          {xp?.rank_title && (
            <p className="font-source-sans" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-4)' }}>
              Rank: <strong className="font-poppins">{xp.rank_title}</strong>
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2" style={{ gap: 'var(--space-10)' }}>
        <form onSubmit={handleProfileSubmit}>
          <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
            <h3 className="font-poppins" style={{ marginBottom: 'var(--space-6)' }}><Icon name="id-card" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />Personal Info</h3>
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={savingProfile} />
            <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={savingProfile} hint="Shown publicly on reviews and comments" />
            <Input label="Email" value={user?.email || ''} disabled />
            <Button type="submit" loading={savingProfile} loadingContext="brand" variant="pill" icon="check">Save Changes</Button>
          </Card>
        </form>

        <form onSubmit={handlePasswordSubmit}>
          <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
            <h3 className="font-poppins" style={{ marginBottom: 'var(--space-6)' }}><Icon name="key" style={{ marginRight: 'var(--space-3)', color: 'var(--accent)' }} />Security</h3>
            <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={savingPassword} />
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="Minimum 10 characters" required disabled={savingPassword} />
            {newPassword && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div className="progress-track" style={{ height: 4 }}>
                  <div className="progress-fill" style={{ width: `${(passwordStrength.score / 3) * 100}%`, background: passwordStrength.color }} />
                </div>
                <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: passwordStrength.color }}>{passwordStrength.label}</span>
              </div>
            )}
            <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={savingPassword} />
            <Button type="submit" loading={savingPassword} loadingContext="conic" variant="3d" icon="lock">Update Password</Button>
          </Card>
        </form>
      </div>

      <Card variant="inset" style={{ padding: 'var(--space-8)', marginTop: 'var(--space-10)' }}>
        <h3 className="font-poppins" style={{ marginBottom: 'var(--space-6)' }}><Icon name="laptop" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />Active Sessions</h3>
        {devicesLoading ? (
          <Spinner context="data" size="sm" />
        ) : devices.length === 0 ? (
          <p className="font-source-sans" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>No active sessions found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {devices.map(session => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <div>
                  <p className="font-poppins" style={{ fontSize: 'var(--text-sm)' }}>
                    {session.user_agent || 'Unknown device'}
                  </p>
                  <span className="font-source-sans" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>
                    {session.ip_address || 'Unknown IP'} &middot; Signed in {formatDate(session.created_at)}
                  </span>
                  {(session.mfa_verified || session.passkey_verified) && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                        {session.passkey_verified ? 'Passkey verified' : 'MFA verified'}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="inset"
                  icon="right-from-bracket"
                  loading={revokingSessionId === session.id}
                  loadingContext="data"
                  onClick={() => handleRevokeSession(session.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card variant="inset" style={{ padding: 'var(--space-8)', marginTop: 'var(--space-10)' }}>
        <h3 className="font-poppins" style={{ marginBottom: 'var(--space-4)' }}><Icon name="bell" style={{ marginRight: 'var(--space-3)', color: 'var(--accent)' }} />Notification Preferences</h3>
        {notificationsLoading ? (
          <Spinner context="data" size="sm" />
        ) : notificationPrefs.length === 0 ? (
          <p className="font-source-sans" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>No notification preferences configured yet.</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)' }} className="font-poppins">Module</th>
                  <th style={{ textAlign: 'center', padding: 'var(--space-2)' }} className="font-poppins">In-App</th>
                  <th style={{ textAlign: 'center', padding: 'var(--space-2)' }} className="font-poppins">Email</th>
                  <th style={{ textAlign: 'center', padding: 'var(--space-2)' }} className="font-poppins">Push</th>
                </tr>
              </thead>
              <tbody>
                {notificationPrefs.map(pref => (
                  <tr key={pref.module}>
                    <td style={{ padding: 'var(--space-2)' }} className="font-source-sans">
                      {NOTIFICATION_MODULE_LABELS[pref.module] || pref.module}
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
                      <input type="checkbox" checked={pref.in_app !== false} onChange={() => handleNotificationToggle(pref.module, 'in_app')} />
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
                      <input type="checkbox" checked={pref.email === true} onChange={() => handleNotificationToggle(pref.module, 'email')} />
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
                      <input type="checkbox" checked={pref.push === true} onChange={() => handleNotificationToggle(pref.module, 'push')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              type="button"
              variant="pill"
              icon="check"
              loading={savingNotifications}
              loadingContext="brand"
              onClick={handleSaveNotifications}
              style={{ marginTop: 'var(--space-6)' }}
            >
              Save Preferences
            </Button>
          </>
        )}
      </Card>

      {profileMeta?.role !== 'teacher' && (
        <Card variant="curved" style={{ padding: 'var(--space-8)', marginTop: 'var(--space-10)', maxWidth: 560 }}>
          <h3 className="font-poppins" style={{ marginBottom: 'var(--space-4)' }}><Icon name="route" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />Request Level Change</h3>
          <p className="font-source-sans" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            Moving to a different level requires admin approval. Your current level is <strong className="font-poppins">{profileMeta?.track || 'Not set'}</strong>.
          </p>

          {pendingLevelChange ? (
            <div style={{ padding: 'var(--space-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <p className="font-poppins" style={{ marginBottom: 'var(--space-2)' }}>
                Request pending review
              </p>
              <p className="font-source-sans" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
                Requested <strong>{pendingLevelChange.requested_level || pendingLevelChange.requested_track}</strong>
                {pendingLevelChange.requested_class ? ` \u2013 ${pendingLevelChange.requested_class}` : ''} on {formatDate(pendingLevelChange.created_at)}.
              </p>
            </div>
          ) : (
            <>
              {resolvedLevelChange && (
                <p className="font-source-sans" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', marginBottom: 'var(--space-4)' }}>
                  Last request ({resolvedLevelChange.requested_level || resolvedLevelChange.requested_track}) was{' '}
                  <strong style={{ color: resolvedLevelChange.status === 'approved' ? 'var(--success)' : 'var(--error)' }}>
                    {resolvedLevelChange.status}
                  </strong>
                  {resolvedLevelChange.reviewed_at ? ` on ${formatDate(resolvedLevelChange.reviewed_at)}` : ''}.
                </p>
              )}
              <form onSubmit={handleLevelChangeRequest}>
                <div className="form-group">
                  <label className="form-label font-poppins">New Level</label>
                  <select className="form-select font-source-sans" value={levelReqTrack} onChange={(e) => setLevelReqTrack(e.target.value)} required disabled={availableLevelsLoading}>
                    <option value="">Select Level</option>
                    {levelChangeOptions.map((lvl) => (
                      <option key={lvl.id || lvl.key || lvl.display_name} value={lvl.display_name}>{lvl.display_name}</option>
                    ))}
                  </select>
                  {availableLevelsLoading && <Spinner context="data" size="sm" />}
                </div>
                <div className="form-group">
                  <label className="form-label font-poppins">Class</label>
                  <select className="form-select font-source-sans" value={levelReqClass} onChange={(e) => setLevelReqClass(e.target.value)} required disabled={!levelReqTrack || levelReqClassesLoading}>
                    <option value="">{levelReqTrack ? 'Select Class' : 'Select a level first'}</option>
                    {levelReqClasses.map((group) => (
                      <option key={group.id} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                  {levelReqClassesLoading && <Spinner context="data" size="sm" />}
                </div>
                <div className="form-group">
                  <label className="form-label font-poppins">Reason</label>
                  <textarea className="form-textarea font-source-sans" rows={3} value={levelReqReason} onChange={(e) => setLevelReqReason(e.target.value)} required />
                </div>
                <Button type="submit" loading={levelReqLoading} loadingContext="brand" variant="inset" icon="route">Submit Request</Button>
              </form>
            </>
          )}
        </Card>
      )}
    </Container>
  );
}
