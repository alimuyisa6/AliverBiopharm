// pages/TutorApply.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../common-layout/PageLayout';
import { useAuth } from '../contexts/AuthContext';
import { getAllSiteSections } from '../api/client';

export default function TutorApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    level: '',
    class_name: '',
    subjects: [],
    qualifications: '',
    experience: '',
  });
  const [existingApplication, setExistingApplication] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllSiteSections().then(setSections).catch(() => {});
    checkExistingApplication();
  }, []);

  const checkExistingApplication = async () => {
    try {
      const res = await fetch('/api/server?module=classroom&path=tutor_status', { credentials: 'include' });
      const data = await res.json();
      if (data && data.application) {
        setExistingApplication(data.application);
      }
    } catch {}
  };

  const LEVELS = {
    'O-Level': {
      classes: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
      color: '#0ab5b5',
      icon: 'fa-microscope',
    },
    'A-Level': {
      classes: ['Form 5', 'Form 6'],
      color: '#b8873a',
      icon: 'fa-dna',
    },
    'Pharmacy': {
      classes: ['Certificate', 'Diploma', 'Degree'],
      color: '#10b981',
      icon: 'fa-capsules',
    },
  };

  const biologyTopics = {
    'O-Level': ['Cell Biology', 'Nutrition', 'Transport in Plants', 'Transport in Animals', 'Respiration', 'Excretion', 'Homeostasis', 'Genetics', 'Evolution', 'Ecology', 'Reproduction', 'Growth and Development'],
    'A-Level': ['Biochemistry', 'Molecular Biology', 'Microbiology', 'Biotechnology', 'Immunology', 'Research Methods', 'Cell Signaling', 'Gene Expression', 'Metabolism', 'Enzymology'],
  };

  const pharmacyTopics = {
    'Certificate': ['Pharmacology I', 'Pharmaceutics I', 'Pharmacognosy', 'Anatomy & Physiology', 'Pharmaceutical Chemistry'],
    'Diploma': ['Clinical Pharmacy', 'Industrial Pharmacy', 'Biostatistics', 'Pharmaceutical Microbiology', 'Pharmacy Management'],
    'Degree': ['Advanced Therapeutics', 'Drug Design & Discovery', 'Regulatory Affairs', 'Pharmacokinetics', 'Research Methodology'],
  };

  const getAvailableTopics = () => {
    if (!form.level || !form.class_name) return [];
    if (form.level === 'Pharmacy') {
      return pharmacyTopics[form.class_name] || [];
    }
    return biologyTopics[form.level] || [];
  };

  const handleSubjectToggle = (subject) => {
    setForm(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  const handleSubmit = async () => {
    if (!form.level || !form.class_name || form.subjects.length === 0) {
      setError('Please complete all required fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await fetch('/api/server', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'classroom',
          path: 'tutor_apply',
          ...form,
        }),
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit application. Please try again.');
    }
    setSubmitting(false);
  };

  const statusLabels = {
    pending: { label: 'Pending Review', color: '#f59e0b', icon: 'fa-clock' },
    scheduled: { label: 'Interview Scheduled', color: '#3b82f6', icon: 'fa-calendar-check' },
    interviewed: { label: 'Interview Completed', color: '#8b5cf6', icon: 'fa-check-double' },
    approved: { label: 'Approved', color: '#10b981', icon: 'fa-circle-check' },
    rejected: { label: 'Rejected', color: '#ef4444', icon: 'fa-circle-xmark' },
  };

  if (existingApplication) {
    const status = statusLabels[existingApplication.status] || statusLabels.pending;
    return (
      <PageLayout sections={sections}>
        <div className="tutor-apply-page">
          <div className="application-status-card">
            <div className="status-icon" style={{ color: status.color }}>
              <i className={`fa-solid ${status.icon}`}></i>
            </div>
            <h2>Application Status: {status.label}</h2>
            <div className="status-details">
              <p><strong>Level:</strong> {existingApplication.level}</p>
              <p><strong>Class:</strong> {existingApplication.class_name}</p>
              <p><strong>Subjects:</strong> {(existingApplication.subjects || []).join(', ')}</p>
              {existingApplication.rejection_reason && (
                <div className="rejection-reason">
                  <strong>Reason:</strong> {existingApplication.rejection_reason}
                </div>
              )}
              {existingApplication.interview_scheduled_at && (
                <div className="interview-info">
                  <strong>Interview:</strong> {new Date(existingApplication.interview_scheduled_at).toLocaleString()}
                </div>
              )}
            </div>
            {existingApplication.status === 'rejected' && (
              <button className="btn-primary" onClick={() => navigate('/classroom/complaint')}>
                <i className="fa-solid fa-flag"></i> File Appeal
              </button>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (submitted) {
    return (
      <PageLayout sections={sections}>
        <div className="tutor-apply-page">
          <div className="application-success">
            <i className="fa-solid fa-circle-check" style={{ color: '#10b981', fontSize: '3rem' }}></i>
            <h2>Application Submitted</h2>
            <p>Your tutor application has been received. An admin will review it and schedule an interview if approved.</p>
            <button className="btn-primary" onClick={() => navigate('/classroom')}>
              <i className="fa-solid fa-users"></i> Back to Classrooms
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout sections={sections}>
      <div className="tutor-apply-page">
        <div className="tutor-apply-header">
          <span className="sec-label">Teaching</span>
          <h1 className="section-title">Become a Tutor</h1>
          <p className="section-subtitle">
            Share your knowledge with fellow students. Verified tutors can lead classroom discussions and help learners succeed.
          </p>
        </div>

        <div className="apply-steps">
          <div className={`apply-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-num">1</span> Level & Class
          </div>
          <div className={`apply-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-num">2</span> Subjects
          </div>
          <div className={`apply-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-num">3</span> Details
          </div>
        </div>

        {step === 1 && (
          <div className="apply-form-section">
            <h3>What level do you want to teach?</h3>
            <div className="apply-grid">
              {Object.entries(LEVELS).map(([key, data]) => (
                <button
                  key={key}
                  className={`apply-card ${form.level === key ? 'selected' : ''}`}
                  style={{ borderColor: form.level === key ? data.color : 'transparent' }}
                  onClick={() => { setForm(prev => ({ ...prev, level: key, class_name: '' })); setStep(2); }}
                >
                  <i className={`fa-solid ${data.icon}`} style={{ color: data.color, fontSize: '2rem' }}></i>
                  <span>{key}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="apply-form-section">
            <button className="apply-back" onClick={() => setStep(1)}>
              <i className="fa-solid fa-arrow-left"></i> Back
            </button>
            <h3>Select your class</h3>
            <div className="apply-grid">
              {(LEVELS[form.level]?.classes || []).map(cls => (
                <button
                  key={cls}
                  className={`apply-card ${form.class_name === cls ? 'selected' : ''}`}
                  style={{ borderColor: form.class_name === cls ? LEVELS[form.level].color : 'transparent' }}
                  onClick={() => { setForm(prev => ({ ...prev, class_name: cls, subjects: [] })); setStep(3); }}
                >
                  <span>{cls}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="apply-form-section">
            <button className="apply-back" onClick={() => setStep(2)}>
              <i className="fa-solid fa-arrow-left"></i> Back
            </button>
            <h3>Select topics you can teach</h3>
            <div className="apply-topics-grid">
              {getAvailableTopics().map(topic => (
                <button
                  key={topic}
                  className={`apply-topic-card ${form.subjects.includes(topic) ? 'selected' : ''}`}
                  onClick={() => handleSubjectToggle(topic)}
                >
                  <i className={`fa-solid ${form.subjects.includes(topic) ? 'fa-check-square' : 'fa-square'}`}></i>
                  {topic}
                </button>
              ))}
            </div>

            <div className="apply-details">
              <h3>Tell us about your qualifications</h3>
              <textarea
                className="apply-textarea"
                placeholder="Describe your qualifications, teaching experience, and why you want to be a tutor..."
                value={form.qualifications}
                onChange={e => setForm(prev => ({ ...prev, qualifications: e.target.value }))}
                rows={5}
              />
            </div>

            {error && <div className="apply-error">{error}</div>}

            <div className="apply-actions">
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Submitting...</>
                ) : (
                  <><i className="fa-solid fa-paper-plane"></i> Submit Application</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
