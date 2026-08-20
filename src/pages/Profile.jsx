 /* pages/Profile.jsx */
import { useState, useEffect, useMemo } from 'react';
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
  const [levelReqReason, setLevelReqReason] = useState('');
  const [levelReqLoading, setLevelReqLoading] = useState(false);

  const [profileMeta, setProfileMeta] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [availableLevels, setAvailableLevels] = useState([]);
  const [availableLevelsLoading, setAvailableLevelsLoading] = useState(false);

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
    if (!profileMeta || profileMeta.role === 'teacher' || availableLevels.length || availableLevelsLoading) return;
    setAvailableLevelsLoading(true);
    getCurriculumLevels()
      .then(data => setAvailableLevels(data || []))
      .catch(() => {})
      .finally(() => setAvailableLevelsLoading(false));
  }, [profileMeta, availableLevels.length, availableLevelsLoading]);

  const levelChangeOptions = useMemo(
    () => availableLevels.filter(lvl => lvl.display_name !== profileMeta?.track),
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

      {profileMeta?.role !== 'teacher' && (
        <Card variant="curved" style={{ padding: 'var(--space-8)', marginTop: 'var(--space-10)', maxWidth: 560 }}>
          <h3 className="font-poppins" style={{ marginBottom: 'var(--space-4)' }}><Icon name="route" style={{ marginRight: 'var(--space-3)', color: 'var(--warm)' }} />Request Level Change</h3>
          <p className="font-source-sans" style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            Moving to a different level requires admin approval. Your current level is <strong className="font-poppins">{profileMeta?.track || 'Not set'}</strong>.
          </p>
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
        </Card>
      )}
    </Container>
  );
}
