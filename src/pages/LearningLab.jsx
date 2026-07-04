 import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import LabHome from '../components/lab/LabHome';
import InteractionMatrix from '../components/lab/InteractionMatrix';
import BioPathways from '../components/lab/BioPathways';
import ClinicalRounds from '../components/lab/ClinicalRounds';
import RxCalc from '../components/lab/RxCalc';

const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    y: 10,
  },
  in: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    scale: 0.98,
    y: -10,
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.25
};

export default function LearningLab() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tool = searchParams.get('tool');

  if (authLoading) {
    return (
      <motion.div
        className="learning-lab"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="lab-loading">Loading...</div>
      </motion.div>
    );
  }

  if (!user) {
    return (
      <motion.div
        className="learning-lab"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
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
      </motion.div>
    );
  }

  if (!tool) {
    return (
      <motion.div
        className="learning-lab"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
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
      </motion.div>
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
    <motion.div
      className="learning-lab"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <div className="lab-page-header">
        <button
          className="lab-back-btn"
          onClick={() => navigate('/lab')}
        >
          <i className="fa-solid fa-arrow-left"></i> Back to Tools
        </button>
      </div>
      {renderTool()}
    </motion.div>
  );
}
