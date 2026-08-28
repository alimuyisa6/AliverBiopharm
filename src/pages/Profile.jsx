import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { updateProfile, changePassword, requestLevelChange, getProfile, getCurriculumLevels, updateDisplayName } from '../api/client';
 
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


const SECTIONS = [
  { id: 'overview', label: 'Profile Overview' },
  { id: 'curriculum', label: 'Learning Curriculum' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security & Login' },
  { id: 'devices', label: 'Connected Devices' },
  { id: 'preferences', label: 'Preferences & Theme' },
  { id: 'referral', label: 'Referral Program' },
  { id: 'parent', label: 'Parent / Guardian' },
  { id: 'billing', label: 'Billing & Payments' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'api', label: 'API Access' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'account', label: 'Account & Data' }
];

function Toggle({ active, onClick }) {
  return <button type="button" className={`toggle-switch${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active} />;
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const { level } = useLayout();
  const addToast = useToast();

  const [activeSection, setActiveSection] = useState('overview');

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBio, setSavingBio] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [levelReqTrack, setLevelReqTrack] = useState('');
  const [levelReqReason, setLevelReqReason] = useState('');
  const [levelReqLoading, setLevelReqLoading] = useState(false);

  const [profileMeta, setProfileMeta] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [availableLevels, setAvailableLevels] = useState([]);
  const [availableLevelsLoading, setAvailableLevelsLoading] = useState(false);

  const [bundle, setBundle] = useState(null);
  const [bundleLoading, setBundleLoading] = useState(true);

  const [notifPrefs, setNotifPrefs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [billing, setBilling] = useState(null);
  const [referral, setReferral] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [sectionLoading, setSectionLoading] = useState(false);

  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Parent');
  const [savingGuardian, setSavingGuardian] = useState(false);

  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name);
    if (user?.profile?.display_name) setDisplayName(user.profile.display_name);
  }, [user]);

  useEffect(() => {
    setProfileLoading(true);
    getProfile()
      .then((data) => {
        setProfileMeta(data);
        setBio(data?.bio || '');
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));

    setBundleLoading(true);
    getSettingsBundle()
      .then(setBundle)
      .catch(() => {})
      .finally(() => setBundleLoading(false));
  }, [user]);

  useEffect(() => {
    if (!profileMeta || profileMeta.role === 'teacher' || availableLevels.length || availableLevelsLoading) return;
    setAvailableLevelsLoading(true);
    getCurriculumLevels()
      .then((data) => setAvailableLevels(data || []))
      .catch(() => {})
      .finally(() => setAvailableLevelsLoading(false));
  }, [profileMeta, availableLevels.length, availableLevelsLoading]);

  const loadSection = useCallback((id) => {
    setSectionLoading(true);
    const done = () => setSectionLoading(false);

    if (id === 'notifications') return getNotificationPreferences().then(setNotifPrefs).catch(() => {}).finally(done);
    if (id === 'devices') return getDevices().then(setDevices).catch(() => {}).finally(done);
    if (id === 'billing') return getBillingSummary().then(setBilling).catch(() => {}).finally(done);
    if (id === 'referral') return getReferralStats().then(setReferral).catch(() => {}).finally(done);
    if (id === 'certificates') return getCertificates().then(setCertificates).catch(() => {}).finally(done);
    if (id === 'api') return getApiKeys().then(setApiKeys).catch(() => {}).finally(done);
    if (id === 'webhooks') return getWebhooks().then(setWebhooks).catch(() => {}).finally(done);
    done();
  }, []);

  useEffect(() => {
    loadSection(activeSection);
  }, [activeSection, loadSection]);

  const levelChangeOptions = useMemo(
    () => availableLevels.filter((lvl) => lvl.display_name !== profileMeta?.track),
    [availableLevels, profileMeta]
  );

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

  const handleBioSubmit = async (e) => {
    e.preventDefault();
    setSavingBio(true);
    try {
      await updateBio(bio.trim());
      addToast('Bio updated', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update bio', 'error');
    } finally {
      setSavingBio(false);
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
    if (!levelReqTrack || !levelReqReason.trim()) { addToast('Please complete all fields', 'error'); return; }
    setLevelReqLoading(true);
    try {
      await requestLevelChange(levelReqTrack, levelReqReason);
      setLevelReqTrack('');
      setLevelReqReason('');
      addToast('Level change request submitted', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to submit request', 'error');
    } finally {
      setLevelReqLoading(false);
    }
  };

  const handleThemeChange = async (color) => {
    try {
      const updated = await updatePreferences({ theme_color: color });
      setBundle((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...updated.profile } } : prev));
    } catch (err) {
      addToast(err.message || 'Failed to update theme', 'error');
    }
  };

  const handleAccessibilityToggle = async (key, currentValue) => {
    const accessibility = { ...(bundle?.profile?.accessibility || {}), [key]: !currentValue };
    try {
      const updated = await updatePreferences({ accessibility });
      setBundle((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...updated.profile } } : prev));
    } catch (err) {
      addToast(err.message || 'Failed to update accessibility setting', 'error');
    }
  };

  const handleNotifToggle = async (module, field, current) => {
    setNotifPrefs((prev) =>
      prev.map((p) => (p.module === module ? { ...p, [field]: !current } : p))
    );
    try {
      await updateNotificationPreference(module, { [field]: !current });
    } catch (err) {
      addToast(err.message || 'Failed to update notification setting', 'error');
      loadSection('notifications');
    }
  };

  const handleRevokeDevice = async (sessionId) => {
    try {
      await revokeDevice(sessionId);
      setDevices((prev) => prev.filter((d) => d.id !== sessionId));
      addToast('Device signed out', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to revoke device', 'error');
    }
  };

  const handleCreateApiKey = async () => {
    setCreatingKey(true);
    try {
      const result = await createApiKey('Default Key');
      setRevealedKey(result.raw_key);
      loadSection('api');
    } catch (err) {
      addToast(err.message || 'Failed to create key', 'error');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId) => {
    try {
      await revokeApiKey(keyId);
      setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, is_active: false } : k)));
    } catch (err) {
      addToast(err.message || 'Failed to revoke key', 'error');
    }
  };

  const handleCreateWebhook = async () => {
    if (!/^https:\/\//.test(newWebhookUrl)) {
      addToast('Enter a valid https:// URL', 'error');
      return;
    }
    setCreatingWebhook(true);
    try {
      await createWebhook(newWebhookUrl, ['*']);
      setNewWebhookUrl('');
      loadSection('webhooks');
      addToast('Webhook created', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to create webhook', 'error');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id) => {
    try {
      await deleteWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      addToast(err.message || 'Failed to delete webhook', 'error');
    }
  };

  const handleSaveGuardian = async (e) => {
    e.preventDefault();
    if (!guardianName.trim() || !guardianEmail.trim()) {
      addToast('Guardian name and email are required', 'error');
      return;
    }
    setSavingGuardian(true);
    try {
      await saveParentGuardian({
        guardian_name: guardianName.trim(),
        guardian_email: guardianEmail.trim(),
        guardian_relationship: guardianRelationship
      });
      addToast('Guardian information saved', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save guardian information', 'error');
    } finally {
      setSavingGuardian(false);
    }
  };

  const handleDataExport = async () => {
    try {
      const result = await requestDataExport();
      addToast(result.already_pending ? 'Export already in progress' : 'Export requested — we will email you a link', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to request export', 'error');
    }
  };

  const handleAccountDeletion = async () => {
    if (!window.confirm('This will schedule your account for deletion. Continue?')) return;
    try {
      const result = await requestAccountDeletion();
      addToast(result.already_pending ? 'Deletion already requested' : 'Account deletion requested', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to request account deletion', 'error');
    }
  };

  if (profileLoading) {
    return (
      <Container>
        <PageHeader title="Profile & Settings" subtitle="Manage your account, curriculum, preferences, security, and more" />
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

  const initial = (profileMeta?.display_name || profileMeta?.full_name || user?.email || 'S').charAt(0).toUpperCase();

  return (
    <Container>
      <PageHeader title="Profile & Settings" subtitle="Manage your account, curriculum, preferences, security, and more" />

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-avatar-lg">{initial}</div>
          <div className="profile-sidebar-name">{profileMeta?.display_name || profileMeta?.full_name || 'Student'}</div>
          <div className="profile-sidebar-level">{profileMeta?.track || 'No level set'} · {profileMeta?.class_name || '—'}</div>

          <div className="profile-stats-grid">
            <div className="profile-stat-tile">
              <div className="stat-num">{bundle?.active_device_count ?? '—'}</div>
              <div className="stat-label">Devices</div>
            </div>
            <div className="profile-stat-tile">
              <div className="stat-num">{bundle?.referral_count ?? '—'}</div>
              <div className="stat-label">Referrals</div>
            </div>
          </div>

          <ul className="profile-nav-list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={activeSection === s.id ? 'active' : ''}
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="profile-content">
          {activeSection === 'overview' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
                <ProfilePictureUpload
                  currentUrl={user?.profile?.profile_picture_url}
                  onUpdate={() => refresh()}
                  size={96}
                />
              </div>
              <form onSubmit={handleProfileSubmit}>
                <Card variant="inset" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
                  <h3 className="profile-section-title"><Icon name="id-card" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />Personal Info</h3>
                  <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={savingProfile} />
                  <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={savingProfile} hint="Shown publicly on reviews and comments" />
                  <Input label="Email" value={profileMeta?.email || user?.email || ''} disabled />
                  <Button type="submit" loading={savingProfile} loadingContext="brand" variant="pill" icon="check">Save Changes</Button>
                </Card>
              </form>
              <form onSubmit={handleBioSubmit}>
                <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
                  <h3 className="profile-section-title"><Icon name="pen" style={{ marginRight: 'var(--space-3)', color: 'var(--secondary)' }} />Bio</h3>
                  <textarea
                    className="form-textarea font-source-sans"
                    rows={3}
                    maxLength={500}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                  />
                  <Button type="submit" loading={savingBio} loadingContext="brand" variant="pill" icon="check" style={{ marginTop: 'var(--space-4)' }}>Save Bio</Button>
                </Card>
              </form>
            </>
          )}

          {activeSection === 'curriculum' && (
            <Card variant="curved" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="route" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />Learning Curriculum</h3>
              <p className="font-source-sans" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                Your current level is <strong className="font-poppins">{profileMeta?.track || 'Not set'}</strong>, class <strong className="font-poppins">{profileMeta?.class_name || 'Not set'}</strong>. Changing levels requires admin approval.
              </p>
              {profileMeta?.role !== 'teacher' && (
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
                    <label className="form-label font-poppins">Reason</label>
                    <textarea className="form-textarea font-source-sans" rows={3} value={levelReqReason} onChange={(e) => setLevelReqReason(e.target.value)} required />
                  </div>
                  <Button type="submit" loading={levelReqLoading} loadingContext="brand" variant="inset" icon="route">Submit Request</Button>
                </form>
              )}
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="bell" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />Notifications</h3>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : (
                notifPrefs.map((p) => (
                  <div className="notification-row" key={p.module}>
                    <div style={{ flex: 1 }}>
                      <div className="notif-title">{p.module.replace(/_/g, ' ')}</div>
                      <div className="notif-desc">In-app · Email · Push</div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <Toggle active={p.in_app} onClick={() => handleNotifToggle(p.module, 'in_app', p.in_app)} />
                      <Toggle active={p.email} onClick={() => handleNotifToggle(p.module, 'email', p.email)} />
                      <Toggle active={p.push} onClick={() => handleNotifToggle(p.module, 'push', p.push)} />
                    </div>
                  </div>
                ))
              )}
              {!sectionLoading && notifPrefs.length === 0 && (
                <p className="font-source-sans" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No notification modules configured yet.</p>
              )}
            </Card>
          )}

          {activeSection === 'security' && (
            <form onSubmit={handlePasswordSubmit}>
              <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
                <h3 className="profile-section-title"><Icon name="key" style={{ marginRight: 'var(--space-3)', color: 'var(--accent)' }} />Security</h3>
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
          )}

          {activeSection === 'devices' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="laptop" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />Connected Devices</h3>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : (
                <ul className="device-list">
                  {devices.map((d) => (
                    <li key={d.id}>
                      <Icon name="laptop" />
                      <div style={{ flex: 1 }}>
                        <div className="device-name">{d.user_agent || 'Unknown device'}</div>
                        <div className="device-meta">{d.ip_address || 'Unknown IP'} · Signed in {new Date(d.created_at).toLocaleDateString()}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleRevokeDevice(d.id)}>Revoke</Button>
                    </li>
                  ))}
                  {devices.length === 0 && <p className="font-source-sans" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No active sessions found.</p>}
                </ul>
              )}
            </Card>
          )}

          {activeSection === 'preferences' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="sliders" style={{ marginRight: 'var(--space-3)', color: 'var(--secondary)' }} />Preferences & Theme</h3>

              <div className="form-group">
                <label className="form-label font-poppins">Accent Color</label>
                <div className="theme-swatch-group">
                  {[
                    { key: 'blue', color: 'var(--blue-600)' },
                    { key: 'teal', color: 'var(--teal-600)' },
                    { key: 'emerald', color: 'var(--emerald-600)' },
                    { key: 'amber', color: 'var(--amber-600)' },
                    { key: 'grey', color: 'var(--grey-700)' }
                  ].map((t) => (
                    <div
                      key={t.key}
                      className={`theme-swatch-option${bundle?.profile?.theme_color === t.key ? ' active' : ''}`}
                      onClick={() => handleThemeChange(t.key)}
                      style={{ '--swatch-color': t.color }}
                    >
                      <div className="theme-swatch" />
                      {t.key}
                    </div>
                  ))}
                </div>
              </div>

              <hr className="divider" style={{ margin: 'var(--space-6) 0' }} />

              <h4 className="font-poppins" style={{ marginBottom: 'var(--space-4)' }}>Accessibility</h4>
              {[
                ['large_text', 'Large text mode'],
                ['high_contrast', 'High contrast mode'],
                ['reduce_motion', 'Reduce motion'],
                ['dyslexia_font', 'Dyslexia-friendly font']
              ].map(([key, label]) => {
                const current = !!bundle?.profile?.accessibility?.[key];
                return (
                  <div className="notification-row" key={key}>
                    <div className="notif-title" style={{ flex: 1 }}>{label}</div>
                    <Toggle active={current} onClick={() => handleAccessibilityToggle(key, current)} />
                  </div>
                );
              })}
            </Card>
          )}

          {activeSection === 'referral' && (
            <Card variant="curved" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="gift" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />Referral Program</h3>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : referral ? (
                <>
                  <p className="font-source-sans">Your Referral Code: <strong style={{ color: 'var(--primary)' }}>{referral.referral_code}</strong></p>
                  <Button
                    variant="pill"
                    icon="copy"
                    style={{ marginTop: 'var(--space-4)' }}
                    onClick={() => { navigator.clipboard.writeText(referral.referral_code); addToast('Referral code copied', 'success'); }}
                  >
                    Copy Referral Code
                  </Button>
                  <p className="font-source-sans text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                    {referral.referral_count} friends joined · {referral.total_xp_earned} XP earned
                  </p>
                </>
              ) : (
                <p className="font-source-sans text-muted">No referral data yet.</p>
              )}
            </Card>
          )}

          {activeSection === 'parent' && (
            <form onSubmit={handleSaveGuardian}>
              <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
                <h3 className="profile-section-title"><Icon name="user-group" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />Parent / Guardian Information</h3>
                <Input label="Guardian Name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required disabled={savingGuardian} />
                <Input label="Guardian Email" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} required disabled={savingGuardian} />
                <div className="form-group">
                  <label className="form-label font-poppins">Relationship</label>
                  <select className="form-select font-source-sans" value={guardianRelationship} onChange={(e) => setGuardianRelationship(e.target.value)}>
                    <option>Parent</option>
                    <option>Guardian</option>
                    <option>Other</option>
                  </select>
                </div>
                <Button type="submit" loading={savingGuardian} loadingContext="brand" variant="pill" icon="check">Save Guardian Info</Button>
              </Card>
            </form>
          )}

          {activeSection === 'billing' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="credit-card" style={{ marginRight: 'var(--space-3)', color: 'var(--success)' }} />Billing & Payments</h3>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : (
                <>
                  <p className="font-source-sans">
                    <strong>Current Plan:</strong> {billing?.current_plan?.name || 'Free'} {billing?.subscription?.expires_at ? `— expires ${new Date(billing.subscription.expires_at).toLocaleDateString()}` : ''}
                  </p>
                  <div style={{ marginTop: 'var(--space-5)' }}>
                    <h4 className="font-poppins" style={{ marginBottom: 'var(--space-3)' }}>Available Plans</h4>
                    {(billing?.available_plans || []).map((p) => (
                      <div key={p.id} className="chart-bar-row" style={{ alignItems: 'center' }}>
                        <span className="chart-bar-label" style={{ width: 160 }}>{p.name}</span>
                        <span className="font-source-sans" style={{ color: 'var(--text-dim)' }}>{p.currency} {p.price_amount} / {p.duration_days} days</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {activeSection === 'certificates' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="award" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />Certificates Earned</h3>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Certificate</th><th>Date Earned</th><th>Score</th><th>Verify</th></tr></thead>
                    <tbody>
                      {certificates.map((c) => (
                        <tr key={c.id}>
                          <td>{c.title}</td>
                          <td>{new Date(c.issued_at).toLocaleDateString()}</td>
                          <td>{c.score != null ? `${c.score}%` : '—'}</td>
                          <td><code>{c.verification_code}</code></td>
                        </tr>
                      ))}
                      {certificates.length === 0 && (
                        <tr><td colSpan={4} className="text-muted">No certificates yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeSection === 'api' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="terminal" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />API Access</h3>
              <p className="font-source-sans text-muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
                Generate API keys to integrate AliverBiopharm with external tools.
              </p>
              {revealedKey && (
                <div className="notification-row" style={{ border: '1px solid var(--warning)', borderRadius: 8, padding: 'var(--space-4)' }}>
                  <div>
                    <div className="notif-title">Copy this key now — it will not be shown again</div>
                    <code style={{ display: 'block', marginTop: 'var(--space-2)', wordBreak: 'break-all' }}>{revealedKey}</code>
                  </div>
                </div>
              )}
              <Button loading={creatingKey} loadingContext="brand" variant="pill" icon="plus" onClick={handleCreateApiKey} style={{ marginBottom: 'var(--space-5)' }}>
                Generate New Key
              </Button>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : (
                apiKeys.map((k) => (
                  <div className="notification-row" key={k.id}>
                    <div style={{ flex: 1 }}>
                      <div className="notif-title">{k.name}</div>
                      <div className="notif-desc"><code>{k.key_prefix}…</code> · {k.is_active ? 'Active' : 'Revoked'}</div>
                    </div>
                    {k.is_active && (
                      <Button variant="outline" size="sm" onClick={() => handleRevokeApiKey(k.id)}>Revoke</Button>
                    )}
                  </div>
                ))
              )}
            </Card>
          )}

          {activeSection === 'webhooks' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="webhook" style={{ marginRight: 'var(--space-3)', color: 'var(--secondary)' }} />Webhooks</h3>
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                <Input
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  style={{ flex: 1, minWidth: 220 }}
                />
                <Button loading={creatingWebhook} loadingContext="brand" variant="pill" icon="plus" onClick={handleCreateWebhook}>Add Webhook</Button>
              </div>
              {sectionLoading ? (
                <Spinner context="data" size="sm" />
              ) : (
                webhooks.map((w) => (
                  <div className="notification-row" key={w.id}>
                    <div style={{ flex: 1 }}>
                      <div className="notif-title">{w.url}</div>
                      <div className="notif-desc">{(w.events || []).join(', ')} · {w.is_active ? 'Active' : 'Disabled'}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteWebhook(w.id)}>Delete</Button>
                  </div>
                ))
              )}
            </Card>
          )}

          {activeSection === 'account' && (
            <Card variant="inset" style={{ padding: 'var(--space-8)' }}>
              <h3 className="profile-section-title"><Icon name="shield" style={{ marginRight: 'var(--space-3)', color: 'var(--error)' }} />Account & Data</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <span className={`status-indicator-dot ${profileMeta?.is_active === false ? 'status-inactive' : 'status-active'}`} />
                <span className="font-source-sans">{profileMeta?.is_active === false ? 'Inactive' : 'Active'} account</span>
              </div>
              <hr className="divider" style={{ margin: 'var(--space-5) 0' }} />
              <p className="font-source-sans text-muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                Account created {profileMeta?.created_at ? new Date(profileMeta.created_at).toLocaleDateString() : '—'}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Button variant="outline" icon="download" onClick={handleDataExport}>Export All Data</Button>
                <Button variant="danger" icon="trash" onClick={handleAccountDeletion}>Request Account Deletion</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Container>
  );
}
