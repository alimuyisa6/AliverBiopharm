import React, { useState, useEffect } from 'react';
import { fetchLabCases, fetchLabCase, submitLabScore } from '../../api/client';

export default function ClinicalRounds({ user }) {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [stageResults, setStageResults] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [level, setLevel] = useState('Pharmacy');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(true);
  const [caseLoading, setCaseLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchLabCases(level, difficulty || null)
      .then(data => {
        setCases(data || []);
        setSelectedCase(null);
        setCaseData(null);
        resetGame();
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [level, difficulty]);

  const resetGame = () => {
    setCurrentStage(0);
    setSelectedOption(null);
    setScore(0);
    setStageResults([]);
    setCompleted(false);
    setFinalScore(null);
  };

  const handleCaseSelect = async (caseItem) => {
    setSelectedCase(caseItem);
    setCaseLoading(true);
    resetGame();
    try {
      const data = await fetchLabCase(caseItem.id);
      setCaseData(data);
    } catch (e) {
      setCaseData(null);
    }
    setCaseLoading(false);
  };

  const handleOptionSelect = (option, optionIndex) => {
    if (selectedOption !== null) return;

    setSelectedOption(optionIndex);
    const isCorrect = option.is_correct;
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);

    setStageResults(prev => [
      ...prev,
      { stageIndex: currentStage, selectedIndex: optionIndex, isCorrect }
    ]);
  };

  const handleNextStage = async () => {
    const stages = caseData?.stages || [];
    if (currentStage >= stages.length - 1) {
      setSubmitting(true);
      const maxScore = stages.length;
      try {
        const result = await submitLabScore(caseData.id, user.id, score, maxScore);
        setFinalScore({ score, maxScore, percentage: Math.round((score / maxScore) * 100) });
      } catch (e) {
        setFinalScore({ score, maxScore: stages.length, percentage: Math.round((score / stages.length) * 100) });
      }
      setSubmitting(false);
      setCompleted(true);
    } else {
      setCurrentStage(prev => prev + 1);
      setSelectedOption(null);
    }
  };

  const handleTryAgain = () => {
    if (selectedCase) {
      handleCaseSelect(selectedCase);
    }
  };

  const handleBackToCases = () => {
    setSelectedCase(null);
    setCaseData(null);
    resetGame();
  };

  const currentStageData = caseData?.stages?.[currentStage];
  const stages = caseData?.stages || [];

  return (
    <div className="learning-lab">
      <div className="lab-tool-container">
        <div className="lab-tool-header">
          <h2 className="lab-tool-heading">
            <i className="fa-solid fa-stethoscope"></i> Clinical Rounds
          </h2>
          <p className="lab-tool-description">
            Diagnose and treat real patient scenarios.
          </p>
        </div>

        <div className="lab-level-filter">
          <label className="lab-level-label">Level:</label>
          <select
            className="lab-level-select"
            value={level}
            onChange={e => setLevel(e.target.value)}
          >
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
          <label className="lab-level-label">Difficulty:</label>
          <select
            className="lab-level-select"
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
          >
            <option value="">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {loading ? (
          <div className="lab-loading">Loading cases...</div>
        ) : !selectedCase ? (
          <div className="lab-cases-grid">
            {cases.map(c => {
              const profile = c.patient_profile || {};
              return (
                <button
                  key={c.id}
                  className="lab-case-card"
                  onClick={() => handleCaseSelect(c)}
                >
                  <h3 className="lab-case-card-title">{c.title}</h3>
                  <div className="lab-case-card-badges">
                    <span className="lab-case-badge lab-case-level">{c.level}</span>
                    <span className="lab-case-badge lab-case-difficulty">{c.difficulty}</span>
                  </div>
                  <div className="lab-case-card-profile">
                    <p><strong>Age:</strong> {profile.age || 'N/A'}</p>
                    <p><strong>Complaint:</strong> {(profile.presenting_complaint || '').substring(0, 60)}{(profile.presenting_complaint || '').length > 60 ? '...' : ''}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : caseLoading ? (
          <div className="lab-loading">Loading case data...</div>
        ) : completed && finalScore ? (
          <div className="lab-score-card">
            <div className="lab-score-icon-wrap">
              <i className={`fa-solid ${finalScore.percentage >= 70 ? 'fa-trophy' : 'fa-heart-pulse'} lab-score-icon`}></i>
            </div>
            <h3 className="lab-score-title">Case Complete</h3>
            <div className="lab-score-value">
              {finalScore.score} / {finalScore.maxScore}
            </div>
            <div className="lab-score-percentage">
              {finalScore.percentage}%
            </div>
            <div className="lab-score-bar-wrap">
              <div className="lab-score-bar">
                <div
                  className="lab-score-bar-fill"
                  style={{
                    width: `${finalScore.percentage}%`,
                    background: finalScore.percentage >= 70 ? 'var(--clr-cyan)' : 'var(--clr-magenta)'
                  }}
                ></div>
              </div>
            </div>
            <div className="lab-score-actions">
              <button className="lab-step-btn" onClick={handleTryAgain}>
                <i className="fa-solid fa-rotate-right"></i> Try Again
              </button>
              <button className="lab-step-btn" onClick={handleBackToCases}>
                <i className="fa-solid fa-list"></i> All Cases
              </button>
            </div>
          </div>
        ) : caseData ? (
          <div className="lab-case-viewer">
            <button
              className="lab-back-btn lab-pathway-back"
              onClick={handleBackToCases}
            >
              <i className="fa-solid fa-arrow-left"></i> All Cases
            </button>

            <h3 className="lab-case-viewer-title">{caseData.title}</h3>

            {caseData.patient_profile && (
              <div className="lab-patient-profile">
                <h4 className="lab-patient-profile-title">
                  <i className="fa-solid fa-user"></i> Patient Profile
                </h4>
                <div className="lab-patient-profile-grid">
                  <div className="lab-patient-item">
                    <span className="lab-patient-label">Age</span>
                    <span className="lab-patient-value">{caseData.patient_profile.age || 'N/A'}</span>
                  </div>
                  <div className="lab-patient-item">
                    <span className="lab-patient-label">Sex</span>
                    <span className="lab-patient-value">{caseData.patient_profile.sex || 'N/A'}</span>
                  </div>
                  <div className="lab-patient-item lab-patient-full">
                    <span className="lab-patient-label">Presenting Complaint</span>
                    <span className="lab-patient-value">{caseData.patient_profile.presenting_complaint || 'N/A'}</span>
                  </div>
                  {caseData.patient_profile.vitals && (
                    <div className="lab-patient-vitals">
                      <span className="lab-vital">BP: {caseData.patient_profile.vitals.bp || 'N/A'}</span>
                      <span className="lab-vital">HR: {caseData.patient_profile.vitals.hr || 'N/A'} bpm</span>
                      <span className="lab-vital">RR: {caseData.patient_profile.vitals.rr || 'N/A'}</span>
                      <span className="lab-vital">SpO2: {caseData.patient_profile.vitals.spo2 || 'N/A'}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="lab-progress-bar-wrap">
              <div className="lab-progress-bar">
                <div
                  className="lab-progress-bar-fill"
                  style={{ width: `${stages.length > 0 ? ((currentStage + 1) / stages.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="lab-progress-text">
                Stage {currentStage + 1} of {stages.length}
              </span>
            </div>

            {currentStageData && (
              <div className="lab-stage-card">
                <div className="lab-stage-type-badge">
                  {currentStageData.stage_type}
                </div>
                <div className="lab-stage-question">
                  {currentStageData.content?.question || 'Review the patient data and select the best option.'}
                </div>
                {currentStageData.content?.lab_results && (
                  <div className="lab-stage-lab-results">
                    {Object.entries(currentStageData.content.lab_results).map(([key, value]) => (
                      <span key={key} className="lab-lab-result">
                        <strong>{key}:</strong> {value}
                      </span>
                    ))}
                  </div>
                )}
                <div className="lab-stage-options">
                  {(currentStageData.options || []).map((option, i) => {
                    let optionClass = 'lab-stage-option';
                    if (selectedOption !== null) {
                      if (option.is_correct) {
                        optionClass += ' lab-stage-option-correct';
                      } else if (selectedOption === i) {
                        optionClass += ' lab-stage-option-incorrect';
                      }
                    }
                    return (
                      <button
                        key={i}
                        className={optionClass}
                        onClick={() => handleOptionSelect(option, i)}
                        disabled={selectedOption !== null}
                      >
                        <span className="lab-option-letter">{String.fromCharCode(65 + i)}</span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedOption !== null && (
              <div className="lab-stage-nav">
                <span className="lab-stage-result">
                  {stageResults[stageResults.length - 1]?.isCorrect
                    ? <span className="lab-result-correct"><i className="fa-solid fa-circle-check"></i> Correct</span>
                    : <span className="lab-result-incorrect"><i className="fa-solid fa-circle-xmark"></i> Incorrect</span>
                  }
                </span>
                <button className="lab-step-btn" onClick={handleNextStage} disabled={submitting}>
                  {currentStage >= stages.length - 1
                    ? (submitting ? 'Submitting...' : 'Finish Case')
                    : 'Next Stage'}
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}

            <div className="lab-score-tracker">
              Score: {score} / {stageResults.length}
            </div>
          </div>
        ) : (
          <div className="lab-empty-state">
            <i className="fa-solid fa-circle-exclamation lab-empty-icon"></i>
            <p>Failed to load case data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
