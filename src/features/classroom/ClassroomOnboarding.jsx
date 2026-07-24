import React, { useState, useEffect } from 'react';
import { getClassroomLevels, getClassroomTopics } from '../../api/cachedClient';

const CARD_COLOR_CLASS = [
  'level-card-cyan',
  'level-card-magenta',
  'level-card-blue',
  'level-card-green',
  'level-card-purple',
  'level-card-orange',
];

const STEP_COLORS = ['var(--clr-cyan)', 'var(--clr-magenta)', 'var(--clr-blue)'];

export function ClassroomOnboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [levels, setLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);

  useEffect(() => {
    getClassroomLevels().then(setLevels).finally(() => setLoadingLevels(false));
  }, []);

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    setSelectedClass(null);
    setSelectedTopic(null);
    setStep(2);
  };

  const handleClassSelect = async (cls) => {
    const className = typeof cls === 'string' ? cls : cls.id;
    setSelectedClass(cls);
    setSelectedTopic(null);
    setStep(3);
    setLoadingTopics(true);
    try {
      const data = await getClassroomTopics(selectedLevel.key, className);
      setTopics(data || []);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleBack = () => {
    if (step === 3) { setSelectedClass(null); setSelectedTopic(null); setTopics([]); setStep(2); }
    else if (step === 2) { setSelectedLevel(null); setSelectedClass(null); setSelectedTopic(null); setStep(1); }
  };

  const handleJoin = () => {
    if (onComplete) {
      onComplete({
        level: selectedLevel.key,
        class_name: typeof selectedClass === 'string' ? selectedClass : selectedClass.id,
        topic: selectedTopic,
      });
    }
  };

  if (loadingLevels) {
    return <div className="classroom-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>;
  }

  return (
    <div className="classroom-onboarding">
      <div className="onboarding-steps">
        {[1, 2, 3].map((n, idx) => (
          <React.Fragment key={n}>
            <div
              className={`onboarding-step ${step >= n ? 'active' : ''}`}
              style={step >= n ? { color: STEP_COLORS[idx] } : undefined}
            >
              <span
                className="step-number"
                style={step >= n ? { borderColor: STEP_COLORS[idx], background: STEP_COLORS[idx], color: '#fff' } : undefined}
              >
                {n}
              </span>
              <span className="step-label">{n === 1 ? 'Level' : n === 2 ? 'Class' : 'Topic'}</span>
            </div>
            {n < 3 && <div className="step-line"></div>}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="onboarding-body">
          <h3>Select Your Level</h3>
          <div className="onboarding-grid">
            {levels.map((lvl, i) => (
              <button
                key={lvl.key}
                className={`onboarding-card ${CARD_COLOR_CLASS[i % CARD_COLOR_CLASS.length]} ${selectedLevel?.key === lvl.key ? 'selected' : ''}`}
                onClick={() => handleLevelSelect(lvl)}
              >
                {lvl.image_url && (
                  <div className="onboarding-card-media">
                    <img src={lvl.image_url} alt={lvl.key} loading="lazy" />
                  </div>
                )}
                <div className="onboarding-card-body">
                  <i className={`fa-solid ${lvl.icon}`}></i>
                  <span>{lvl.key}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && selectedLevel && (
        <div className="onboarding-body">
          <button className="onboarding-back" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left" style={{ color: 'var(--clr-blue)' }}></i> Back
          </button>
          <h3>Select Your Class</h3>
          <div className="onboarding-grid">
            {selectedLevel.classes.map((cls, i) => {
              const isObj = typeof cls !== 'string';
              const key = isObj ? cls.id : cls;
              const label = isObj ? cls.name : cls;
              const imageUrl = isObj ? cls.image_url : null;
              return (
                <button
                  key={key}
                  className={`onboarding-card ${CARD_COLOR_CLASS[i % CARD_COLOR_CLASS.length]} ${selectedClass === cls ? 'selected' : ''}`}
                  onClick={() => handleClassSelect(cls)}
                >
                  {imageUrl && (
                    <div className="onboarding-card-media">
                      <img src={imageUrl} alt={label} loading="lazy" />
                    </div>
                  )}
                  <div className="onboarding-card-body">
                    <i className={`fa-solid ${isObj ? cls.icon || 'fa-mortar-pestle' : selectedLevel.icon}`}></i>
                    <span>{label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-body">
          <button className="onboarding-back" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left" style={{ color: 'var(--clr-blue)' }}></i> Back
          </button>
          <h3>Select a Topic</h3>
          {loadingTopics ? (
            <div className="classroom-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : topics.length === 0 ? (
            <div className="onboarding-empty">No topics available for this class.</div>
          ) : (
            <div className="onboarding-topic-list">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  className={`onboarding-topic-card ${selectedTopic?.id === topic.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTopic(topic)}
                >
                  <div className="topic-card-content">
                    {topic.is_hard_topic ? (
                      <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--clr-red)' }}></i>
                    ) : (
                      <i className="fa-solid fa-book-open" style={{ color: 'var(--clr-cyan)' }}></i>
                    )}
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
            <i className="fa-solid fa-door-open"></i> Find Classrooms
          </button>
        </div>
      )}
    </div>
  );
}
 
