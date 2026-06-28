import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LabHome from '../components/lab/LabHome';
import InteractionMatrix from '../components/lab/InteractionMatrix';
import BioPathways from '../components/lab/BioPathways';
import ClinicalRounds from '../components/lab/ClinicalRounds';
import RxCalc from '../components/lab/RxCalc';

export default function LearningLab() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tool = searchParams.get('tool');

  if (!user) {
    return (
      <div className="learning-lab">
        <div className="lab-locked-screen">
          <div className="lab-locked-icon-wrap">
            <i className="fa-solid fa-lock lab-locked-icon"></i>
          </div>
          <h2 className="lab-locked-title">Learning Lab Access Required</h2>
          <p className="lab-locked-text">
            The Learning Lab is available to authenticated users only.
            Sign in to access interactive biology and pharmacy tools.
          </p>
          <button
            className="lab-locked-btn"
            onClick={() => navigate('/login')}
          >
            <i className="fa-solid fa-right-to-bracket"></i> Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="learning-lab">
        <div className="lab-page-header">
          <button
            className="lab-back-btn"
            onClick={() => navigate('/#learning-lab')}
          >
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </button>
          <h1 className="lab-page-title">Learning Lab</h1>
          <p className="lab-page-subtitle">Select a tool to begin your interactive learning session.</p>
        </div>
        <LabHome user={user} navigate={navigate} />
      </div>
    );
  }

  const renderTool = () => {
    switch (tool) {
      case 'interaction-matrix':
        return <InteractionMatrix user={user} />;
      case 'biopathways':
        return <BioPathways user={user} />;
      case 'clinical-rounds':
        return <ClinicalRounds user={user} />;
      case 'rxcalc':
        return <RxCalc user={user} />;
      default:
        return (
          <div className="lab-empty-state">
            <i className="fa-solid fa-circle-question lab-empty-icon"></i>
            <p>Unknown tool selected.</p>
            <button
              className="lab-back-btn"
              onClick={() => navigate('/lab')}
            >
              Back to Lab
            </button>
          </div>
        );
    }
  };

  return (
    <div className="learning-lab">
      <div className="lab-page-header">
        <button
          className="lab-back-btn"
          onClick={() => navigate('/lab')}
        >
          <i className="fa-solid fa-arrow-left"></i> Back to Tools
        </button>
      </div>
      {renderTool()}
    </div>
  );
}
