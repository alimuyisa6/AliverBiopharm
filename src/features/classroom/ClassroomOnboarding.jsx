 // features/classroom/ClassroomOnboarding.jsx
import React, { useState } from 'react';

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

const hardTopics = ['Genetics', 'Molecular Biology', 'Biotechnology', 'Immunology', 'Advanced Therapeutics', 'Pharmacokinetics'];

function getTopics(level, className) {
  if (level === 'Pharmacy') {
    return (pharmacyTopics[className] || []).map(name => ({ topic_name: name, is_hard_topic: hardTopics.includes(name) }));
  }
  return (biologyTopics[level] || []).map(name => ({ topic_name: name, is_hard_topic: hardTopics.includes(name) }));
}

export function ClassroomOnboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

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
  const topics = selectedLevel && selectedClass ? getTopics(selectedLevel, selectedClass) : [];

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
          {topics.length === 0 ? (
            <div className="onboarding-empty">No topics available for this class.</div>
          ) : (
            <div className="onboarding-topic-list">
              {topics.map((topic, index) => (
                <button
                  key={topic.topic_name || index}
                  className={`onboarding-topic-card ${selectedTopic?.topic_name === topic.topic_name ? 'selected' : ''}`}
                  onClick={() => handleTopicSelect(topic)}
                >
                  <div className="topic-card-content">
                    <span className="topic-name">{topic.topic_name}</span>
                    {topic.is_hard_topic && <span className="topic-badge hard">Hard Topic</span>}
                  </div>
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
