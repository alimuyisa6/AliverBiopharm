// features/classroom/ClassroomOnboarding.jsx
import React, { useState, useEffect } from 'react';

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

export function ClassroomOnboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedLevel && selectedClass) {
      setLoading(true);
      setError(null);
      fetch(`/api/server?module=classroom&path=topics&level=${encodeURIComponent(selectedLevel)}&class_name=${encodeURIComponent(selectedClass)}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setTopics(data.data || data || []);
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load topics');
          setLoading(false);
        });
    }
  }, [selectedLevel, selectedClass]);

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    setSelectedClass(null);
    setSelectedTopic(null);
    setStep(2);
  };

  const handleClassSelect = (cls) => {
    setSelectedClass(cls);
    setSelectedTopic(null);
    setStep(3);
  };

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
  };

  const handleJoin = () => {
    if (onComplete) {
      onComplete({ level: selectedLevel, class_name: selectedClass, topic: selectedTopic });
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setSelectedClass(null);
      setSelectedTopic(null);
      setStep(2);
    } else if (step === 2) {
      setSelectedLevel(null);
      setSelectedClass(null);
      setSelectedTopic(null);
      setStep(1);
    }
  };

  const currentLevel = LEVELS[selectedLevel];

  return (
    <div className="classroom-onboarding">
      <div className="onboarding-steps">
        <div className={`onboarding-step ${step >= 1 ? 'active' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Level</span>
        </div>
        <div className="step-line"></div>
        <div className={`onboarding-step ${step >= 2 ? 'active' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Class</span>
        </div>
        <div className="step-line"></div>
        <div className={`onboarding-step ${step >= 3 ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Topic</span>
        </div>
      </div>

      {step === 1 && (
        <div className="onboarding-body">
          <h3>Select Your Level</h3>
          <div className="onboarding-grid">
            {Object.entries(LEVELS).map(([key, data]) => (
              <button
                key={key}
                className={`onboarding-card ${selectedLevel === key ? 'selected' : ''}`}
                style={{ borderColor: selectedLevel === key ? data.color : 'transparent' }}
                onClick={() => handleLevelSelect(key)}
              >
                <i className={`fa-solid ${data.icon}`} style={{ color: data.color, fontSize: '2rem' }}></i>
                <span>{key}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && currentLevel && (
        <div className="onboarding-body">
          <button className="onboarding-back" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
          <h3>Select Your Class</h3>
          <div className="onboarding-grid">
            {currentLevel.classes.map(cls => (
              <button
                key={cls}
                className={`onboarding-card ${selectedClass === cls ? 'selected' : ''}`}
                style={{ borderColor: selectedClass === cls ? currentLevel.color : 'transparent' }}
                onClick={() => handleClassSelect(cls)}
              >
                <i className={`fa-solid ${currentLevel.icon}`} style={{ color: currentLevel.color, fontSize: '2rem' }}></i>
                <span>{cls}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-body">
          <button className="onboarding-back" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
          <h3>Select a Topic</h3>
          {loading && <div className="onboarding-loading">Loading topics...</div>}
          {error && <div className="onboarding-error">{error}</div>}
          {!loading && !error && topics.length === 0 && (
            <div className="onboarding-empty">No topics available for this class.</div>
          )}
          {!loading && !error && topics.length > 0 && (
            <div className="onboarding-topic-list">
              {topics.map(topic => (
                <button
                  key={topic.id || topic.topic_name || topic.unit_name}
                  className={`onboarding-topic-card ${selectedTopic?.id === topic.id || selectedTopic?.topic_name === topic.topic_name ? 'selected' : ''}`}
                  onClick={() => handleTopicSelect(topic)}
                >
                  <div className="topic-card-content">
                    <span className="topic-name">{topic.topic_name || topic.unit_name || topic.name}</span>
                    {topic.is_hard_topic && <span className="topic-badge hard">Hard Topic</span>}
                  </div>
                  {topic.unit_code && <span className="topic-code">{topic.unit_code}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTopic && (
        <div className="onboarding-footer">
          <button className="btn-primary" onClick={handleJoin}>
            <i className="fa-solid fa-door-open"></i>
            Find Classrooms
          </button>
        </div>
      )}
    </div>
  );
}
