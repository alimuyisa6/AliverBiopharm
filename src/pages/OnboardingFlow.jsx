 /* pages/OnboardingFlow.jsx */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveOnboarding, getClassSequence, getPharmacyPrograms } from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';

const TRACKS = [
  { value: 'O-Level', icon: 'seedling', label: 'O-Level', description: 'Senior 1 – 4' },
  { value: 'A-Level', icon: 'flask', label: 'A-Level', description: 'Senior 5 – 6' },
  { value: 'Pharmacy', icon: 'capsules', label: 'Pharmacy', description: 'Certificate, Diploma, Degree' },
];

export default function OnboardingFlow() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState(null);
  const [track, setTrack] = useState(null);
  const [className, setClassName] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.profile?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!track) return;
    if (track === 'Pharmacy') {
      getPharmacyPrograms()
        .then((data) => setClasses((data || []).map((p) => ({ value: p.program_name, label: p.program_name, description: p.description }))))
        .catch(() => setClasses([]));
    } else {
      getClassSequence(track)
        .then((data) => setClasses((data || []).map((c) => ({ value: c.class_name, label: c.class_name }))))
        .catch(() => setClasses([]));
    }
  }, [track]);

  const handleFinish = async () => {
    if (!role || !track || !className) return;
    setLoading(true);
    setError('');
    try {
      await saveOnboarding({ role, track, class_name: className });
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  const pct = step === 0 ? 10 : step === 1 ? 45 : step === 2 ? 80 : 100;

  return (
    <div className="section" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 'var(--space-16)' }}>
      <div className="progress-track" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="progress-fill progress-gradient" style={{ width: `${pct}%` }} />
      </div>

      {step === 0 && (
        <div style={{ animation: 'fadeIn var(--ease-smooth) forwards' }}>
          <span className="sec-label" style={{ textAlign: 'left' }}>Step 1 of 3</span>
          <h2 style={{ marginBottom: 'var(--space-3)' }}>Choose Your Role</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-8)' }}>How will you use AliverBiopharm?</p>
          <div className="grid grid-cols-2">
            {['student', 'teacher'].map((r) => (
              <button
                key={r}
                className={`card card-clickable ${role === r ? 'card-selected' : ''}`}
                onClick={() => { setRole(r); setStep(1); }}
                style={{ textAlign: 'center', padding: 'var(--space-8)' }}
              >
                <Icon name={r === 'student' ? 'user-graduate' : 'user-pen'} style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }} />
                <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ animation: 'fadeIn var(--ease-smooth) forwards' }}>
          <span className="sec-label" style={{ textAlign: 'left' }}>Step 2 of 3</span>
          <h2 style={{ marginBottom: 'var(--space-3)' }}>Select Your Track</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-8)' }}>This determines the content you'll see.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {TRACKS.map((t) => (
              <button
                key={t.value}
                className={`card card-clickable ${track === t.value ? 'card-selected' : ''}`}
                onClick={() => { setTrack(t.value); setClassName(null); setStep(2); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)' }}
              >
                <Icon name={t.icon} style={{ fontSize: '2rem' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{t.label}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>{t.description}</div>
                </div>
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 'var(--space-6)' }} onClick={() => setStep(0)}>
            <Icon name="arrow-left" /> Back
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ animation: 'fadeIn var(--ease-smooth) forwards' }}>
          <span className="sec-label" style={{ textAlign: 'left' }}>Step 3 of 3</span>
          <h2 style={{ marginBottom: 'var(--space-3)' }}>
            {track === 'Pharmacy' ? 'Select Your Programme' : 'Select Your Class'}
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-8)' }}>
            {track === 'Pharmacy' ? 'Which pharmacy programme?' : `Which ${track} class?`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {classes.map((c) => (
              <button
                key={c.value}
                className={`card card-clickable ${className === c.value ? 'card-selected' : ''}`}
                onClick={() => setClassName(c.value)}
                style={{ padding: 'var(--space-5)' }}
              >
                <span style={{ fontWeight: 600 }}>{c.label}</span>
                {c.description && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)', marginLeft: 'var(--space-3)' }}>{c.description}</span>}
              </button>
            ))}
          </div>
          {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              <Icon name="arrow-left" /> Back
            </button>
            <button className="btn btn-primary" onClick={handleFinish} disabled={!className || loading}>
              {loading ? <Spinner size="sm" /> : <><Icon name="check" /> Complete Setup</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
