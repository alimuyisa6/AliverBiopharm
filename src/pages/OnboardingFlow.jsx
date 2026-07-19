 import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveOnboarding, getClassSequence, getPharmacyPrograms } from '../api/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaUserGraduate, FaChalkboardUser, FaSeedling, FaFlask, FaCapsules, FaArrowRight, FaArrowLeft, FaSpinner, FaCheck } from 'react-icons/fa6';

const TRACKS = [
  { value: 'O-Level', icon: FaSeedling, label: 'O-Level', description: 'Senior 1 – 4' },
  { value: 'A-Level', icon: FaFlask, label: 'A-Level', description: 'Senior 5 – 6' },
  { value: 'Pharmacy', icon: FaCapsules, label: 'Pharmacy', description: 'Certificate, Diploma, Degree' },
];

export default function OnboardingFlow() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isClassOnly = searchParams.get('classOnly') === 'true' && user?.profile?.track;

  const [step, setStep] = useState(isClassOnly ? 2 : 0);
  const [role, setRole] = useState(null);
  const [track, setTrack] = useState(null);
  const [className, setClassName] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const targetTrack = isClassOnly ? user.profile.track : track;
    if (targetTrack) {
      if (targetTrack === 'Pharmacy') {
        getPharmacyPrograms().then(data => {
          setClasses((data || []).map(p => ({ value: p.program_name, label: p.program_name, description: p.description })));
        }).catch(() => setClasses([]));
      } else {
        getClassSequence(targetTrack).then(data => {
          setClasses((data || []).map(c => ({ value: c.class_name, label: c.class_name })));
        }).catch(() => setClasses([]));
      }
    }
  }, [track, isClassOnly, user]);

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      const payload = isClassOnly
        ? { class_name: className }
        : { role, track, class_name: className };
      await saveOnboarding(payload);
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save your choices. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function progressPct() {
    if (step === 0) return 5;
    if (step === 1) return 35;
    return 70;
  }

  return (
    <div className="fc-page">
      <div className="fc-page-inner">
        <div className="fc-progress-track">
          <div className="fc-progress-fill" style={{ width: `${progressPct()}%` }} />
        </div>

        {!isClassOnly && step === 0 && (
          <div className="fc-step">
            <span className="fc-step-label">Step 1 of 3</span>
            <h1 className="fc-step-title">I am a...</h1>
            <p className="fc-step-subtitle">Choose your role on AliverBiopharm.</p>
            <div className="fc-option-grid fc-cols-1">
              <button className={`fc-option-btn ${role === 'student' ? 'fc-selected' : ''}`} onClick={() => { setRole('student'); setStep(1); }}>
                <FaUserGraduate className="fc-option-icon" />
                <span className="fc-option-label">Student</span>
                <span className="fc-option-sub">I'm here to learn</span>
              </button>
              <button className={`fc-option-btn ${role === 'teacher' ? 'fc-selected' : ''}`} onClick={() => { setRole('teacher'); setStep(1); }}>
                <FaChalkboardUser className="fc-option-icon" />
                <span className="fc-option-label">Teacher</span>
                <span className="fc-option-sub">I'm here to teach or contribute content</span>
              </button>
            </div>
          </div>
        )}

        {!isClassOnly && step === 1 && (
          <div className="fc-step">
            <span className="fc-step-label">Step 2 of 3</span>
            <h1 className="fc-step-title">Select your track</h1>
            <p className="fc-step-subtitle">This determines what content you see.</p>
            <div className="fc-option-grid fc-cols-1">
              {TRACKS.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.value} className={`fc-option-btn ${track === t.value ? 'fc-selected' : ''}`} onClick={() => { setTrack(t.value); setClassName(null); setStep(2); }}>
                    <Icon className="fc-option-icon" />
                    <span className="fc-option-label">{t.label}</span>
                    <span className="fc-option-sub">{t.description}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button className="fc-btn fc-btn-ghost" onClick={() => { setStep(0); setTrack(null); }}>
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        )}

        {(isClassOnly || step === 2) && (
          <div className="fc-step">
            <span className="fc-step-label">{isClassOnly ? 'Update your class' : 'Step 3 of 3'}</span>
            <h1 className="fc-step-title">
              {track === 'Pharmacy' || (isClassOnly && user.profile.track === 'Pharmacy') ? 'Select your programme' : 'Select your class'}
            </h1>
            <p className="fc-step-subtitle">
              {track === 'Pharmacy' || (isClassOnly && user.profile.track === 'Pharmacy')
                ? 'Which pharmacy programme are you enrolled in?'
                : `Which ${track || user.profile.track} class are you in?`}
            </p>
            <div className="fc-option-grid fc-cols-1">
              {classes.map(c => (
                <button key={c.value} className={`fc-option-btn ${className === c.value ? 'fc-selected' : ''}`} onClick={() => setClassName(c.value)}>
                  <span className="fc-option-label">{c.label}</span>
                  {c.description && <span className="fc-option-sub">{c.description}</span>}
                </button>
              ))}
            </div>
            {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {!isClassOnly && (
                <button className="fc-btn fc-btn-ghost" onClick={() => setStep(1)}>
                  <FaArrowLeft /> Back
                </button>
              )}
              <button className="fc-btn fc-btn-primary" onClick={handleFinish} disabled={!className || loading}>
                {loading ? <><FaSpinner className="icon-spin" /> Saving...</> : <><FaCheck /> {isClassOnly ? 'Update Class' : 'Complete Setup'}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
