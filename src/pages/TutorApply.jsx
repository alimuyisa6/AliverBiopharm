 // pages/TutorApply.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getAllSiteSections, getClassroomLevels, getClassroomTopics, applyAsTutor } from '../api/client';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3
};

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
  const [levels, setLevels] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    getAllSiteSections().then(setSections).catch(() => {});
    checkExistingApplication();
    fetchLevels();
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

  const fetchLevels = async () => {
    try {
      const data = await getClassroomLevels();
      setLevels(data || []);
    } catch {}
  };

  const fetchTopics = async (level, className) => {
    setLoadingTopics(true);
    try {
      const data = await getClassroomTopics(level, className);
      setTopics(data || []);
    } catch {
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleLevelSelect = (level) => {
    setForm(prev => ({ ...prev, level: level.key, class_name: '', subjects: [] }));
    setStep(2);
  };

  const handleClassSelect = (cls) => {
    const className = typeof cls === 'string' ? cls : cls.id;
    setForm(prev => ({ ...prev, class_name: className, subjects: [] }));
    fetchTopics(form.level, className);
    setStep(3);
  };

  const handleSubjectToggle = (topic) => {
    setForm(prev => ({
      ...prev,
      subjects: prev.subjects.includes(topic.topic_name)
        ? prev.subjects.filter(s => s !== topic.topic_name)
        : [...prev.subjects, topic.topic_name],
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
      await applyAsTutor(form.level, form.class_name, form.subjects, form.qualifications, form.experience);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit application. Please try again.');
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

  const CARD_COLOR_CLASS = ['level-card-cyan', 'level-card-magenta', 'level-card-blue'];

  if (existingApplication) {
    const status = statusLabels[existingApplication.status] || statusLabels.pending;
    return (
      <motion.div
        className="tutor-apply-page"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
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
          <div className="status-actions">
            <button className="btn-primary" onClick={() => navigate('/tutor/dashboard')}>
              <i className="fa-solid fa-gauge"></i> Tutor Dashboard
            </button>
            {existingApplication.status === 'rejected' && (
              <button className="btn-secondary" onClick={() => navigate('/classroom/complaint')}>
                <i className="fa-solid fa-flag"></i> File Appeal
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (submitted) {
    return (
      <motion.div
        className="tutor-apply-page"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        <div className="application-success">
          <i className="fa-solid fa-circle-check" style={{ color: '#10b981', fontSize: '3rem' }}></i>
          <h2>Application Submitted</h2>
          <p>Your tutor application has been received. An admin will review it and schedule an interview if approved.</p>
          <div className="tutor-success-actions">
            <button className="btn-primary" onClick={() => navigate('/tutor/dashboard')}>
              <i className="fa-solid fa-gauge"></i> Go to Tutor Dashboard
            </button>
            <button className="btn-secondary" onClick={() => navigate('/classroom')}>
              <i className="fa-solid fa-users"></i> Back to Classrooms
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="tutor-apply-page"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
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
            {levels.map((lvl, i) => (
              <button
                key={lvl.key}
                className={`apply-card ${CARD_COLOR_CLASS[i % 3]} ${form.level === lvl.key ? 'selected' : ''}`}
                onClick={() => handleLevelSelect(lvl)}
              >
                <i className={`fa-solid ${lvl.icon}`} style={{ fontSize: '2rem' }}></i>
                <span>{lvl.key}</span>
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
            {(levels.find(l => l.key === form.level)?.classes || []).map((cls, i) => {
              const isObj = typeof cls !== 'string';
              const key = isObj ? cls.id : cls;
              const label = isObj ? cls.name : cls;
              const icon = isObj ? cls.icon || 'fa-mortar-pestle' : levels.find(l => l.key === form.level)?.icon;
              return (
                <button
                  key={key}
                  className={`apply-card ${CARD_COLOR_CLASS[i % 3]} ${form.class_name === key ? 'selected' : ''}`}
                  onClick={() => handleClassSelect(cls)}
                >
                  <i className={`fa-solid ${icon}`}></i>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="apply-form-section">
          <button className="apply-back" onClick={() => setStep(2)}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
          <h3>Select topics you can teach</h3>
          {loadingTopics ? (
            <div className="classroom-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : topics.length === 0 ? (
            <div className="onboarding-empty">No topics available for this class.</div>
          ) : (
            <div className="apply-topics-grid">
              {topics.map(topic => (
                <button
                  key={topic.id}
                  className={`apply-topic-card ${form.subjects.includes(topic.topic_name) ? 'selected' : ''}`}
                  onClick={() => handleSubjectToggle(topic)}
                >
                  <i className={`fa-solid ${form.subjects.includes(topic.topic_name) ? 'fa-check-square' : 'fa-square'}`}></i>
                  {topic.topic_name}
                  {topic.is_hard_topic && <span className="topic-badge hard">Hard</span>}
                </button>
              ))}
            </div>
          )}

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

          <div className="apply-details">
            <h3>Teaching Experience</h3>
            <textarea
              className="apply-textarea"
              placeholder="Describe your teaching or tutoring experience..."
              value={form.experience}
              onChange={e => setForm(prev => ({ ...prev, experience: e.target.value }))}
              rows={4}
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
    </motion.div>
  );
}
