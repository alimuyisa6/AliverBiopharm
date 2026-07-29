 import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveOnboarding, getClassSequence, getPharmacyPrograms } from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  FaUserGraduate,
  FaChalkboardUser,
  FaSeedling,
  FaFlask,
  FaCapsules,
  FaArrowRight,
  FaArrowLeft,
  FaSpinner,
  FaCheck,
  FaGraduationCap,
  FaBookOpen
} from 'react-icons/fa6';

const TRACKS = [
  { value: 'O-Level', icon: FaSeedling, label: 'O-Level', description: 'Senior 1 – 4', colorClass: 'olevel' },
  { value: 'A-Level', icon: FaFlask, label: 'A-Level', description: 'Senior 5 – 6', colorClass: 'alevel' },
  { value: 'Pharmacy', icon: FaCapsules, label: 'Pharmacy', description: 'Certificate, Diploma, Degree', colorClass: 'pharmacy' }
];

const ROLE_ICONS = {
  student: FaUserGraduate,
  teacher: FaChalkboardUser
};

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
    if (track) {
      if (track === 'Pharmacy') {
        getPharmacyPrograms()
          .then(data => {
            setClasses((data || []).map(p => ({
              value: p.program_name,
              label: p.program_name,
              description: p.description,
              icon: FaGraduationCap
            })));
          })
          .catch(() => setClasses([]));
      } else {
        getClassSequence(track)
          .then(data => {
            setClasses((data || []).map(c => ({
              value: c.class_name,
              label: c.class_name,
              icon: FaBookOpen
            })));
          })
          .catch(() => setClasses([]));
      }
    }
  }, [track]);

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      await saveOnboarding({ role, track, class_name: className });
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save your choices. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function progressPct() {
    if (step === 0) return 8;
    if (step === 1) return 40;
    if (step === 2) return 75;
    return 100;
  }

  const trackColorClass = TRACKS.find(t => t.value === track)?.colorClass || '';

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-progress-track">
          <div
            className="onboarding-progress-fill"
            style={{ '--progress-width': `${progressPct()}%` }}
          />
        </div>

        {step === 0 && (
          <div className="onboarding-step">
            <span className="onboarding-step-label">Step 1 of 3</span>
            <h1 className="onboarding-step-title">Choose Your Role</h1>
            <p className="onboarding-step-subtitle">Select how you'll use AliverBiopharm</p>
            <div className="onboarding-role-grid">
              {['student', 'teacher'].map((r) => {
                const Icon = ROLE_ICONS[r];
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    className={`onboarding-role-btn ${r} ${isSelected ? 'selected' : ''}`}
                    onClick={() => { setRole(r); setStep(1); }}
                  >
                    <Icon className="onboarding-role-icon" />
                    <span className="onboarding-role-label">{r.charAt(0).toUpperCase() + r.slice(1)}</span>
                    <span className="onboarding-role-sub">
                      {r === 'student' ? "I'm here to learn" : "I'm here to teach or contribute"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <span className="onboarding-step-label">Step 2 of 3</span>
            <h1 className="onboarding-step-title">Select Your Track</h1>
            <p className="onboarding-step-subtitle">This determines what content you'll see</p>
            <div className="onboarding-track-grid">
              {TRACKS.map(t => {
                const Icon = t.icon;
                const isSelected = track === t.value;
                return (
                  <button
                    key={t.value}
                    className={`onboarding-track-btn ${t.colorClass} ${isSelected ? 'selected' : ''}`}
                    onClick={() => { setTrack(t.value); setClassName(null); setStep(2); }}
                  >
                    <Icon className="onboarding-track-icon" />
                    <span className="onboarding-track-label">{t.label}</span>
                    <span className="onboarding-track-sub">{t.description}</span>
                  </button>
                );
              })}
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-btn-ghost" onClick={() => { setStep(0); setTrack(null); }}>
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={`onboarding-step track-${trackColorClass}`}>
            <span className="onboarding-step-label">Step 3 of 3</span>
            <h1 className="onboarding-step-title">
              {track === 'Pharmacy' ? 'Select Your Programme' : 'Select Your Class'}
            </h1>
            <p className="onboarding-step-subtitle">
              {track === 'Pharmacy'
                ? 'Which pharmacy programme are you enrolled in?'
                : `Which ${track} class are you in?`}
            </p>
            <div className="onboarding-class-grid">
              {classes.map(c => {
                const Icon = c.icon || FaBookOpen;
                const isSelected = className === c.value;
                return (
                  <button
                    key={c.value}
                    className={`onboarding-class-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setClassName(c.value)}
                  >
                    <Icon className="onboarding-class-icon" />
                    <span className="onboarding-class-label">{c.label}</span>
                    {c.description && (
                      <span className="onboarding-class-sub">{c.description}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {error && <div className="onboarding-error">{error}</div>}
            <div className="onboarding-nav onboarding-nav-final">
              <button className="onboarding-btn-ghost" onClick={() => setStep(1)}>
                <FaArrowLeft /> Back
              </button>
              <button
                className="onboarding-btn-primary"
                onClick={handleFinish}
                disabled={!className || loading}
              >
                {loading ? (
                  <>
                    <FaSpinner className="icon-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FaCheck />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
