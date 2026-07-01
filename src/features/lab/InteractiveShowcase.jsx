// features/lab/InteractiveShowcase.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export function InteractiveShowcase() {
  const navigate = useNavigate();

  const labTools = [
    { slug: 'interaction-matrix', icon: 'fa-circle-nodes', title: 'Interaction Matrix', subtitle: 'Visualize drug interactions in real time.', color: '#00bcd4' },
    { slug: 'biopathways', icon: 'fa-dna', title: 'BioPathways', subtitle: 'Walk through biological pathways step by step.', color: '#e91e8c' },
    { slug: 'clinical-rounds', icon: 'fa-stethoscope', title: 'Clinical Rounds', subtitle: 'Diagnose and treat real patient scenarios.', color: '#00bcd4' },
    { slug: 'rxcalc', icon: 'fa-flask-vial', title: 'RxCalc', subtitle: 'Master dosing with formula-driven calculations.', color: '#e91e8c' },
  ];

  return (
    <section id="learning-lab" className="section reveal">
      <span className="sec-label">Learning Lab</span>
      <h2 className="section-title">Learn by Doing, Not Just Reading</h2>
      <p className="section-subtitle">
        Hands-on tools built for O-Level, A-Level and Pharmacy students. Practice, calculate, and explore at your own pace.
      </p>
      <div className="lab-home-grid">
        {labTools.map(tool => (
          <div key={tool.slug} className="lab-tool-card" style={{ borderTopColor: tool.color }}>
            <div className="lab-tool-icon-wrap" style={{ color: tool.color }}>
              <i className={`fa-solid ${tool.icon}`}></i>
            </div>
            <h3 className="lab-tool-title">{tool.title}</h3>
            <p className="lab-tool-subtitle">{tool.subtitle}</p>
            <button
              className="lab-tool-btn"
              style={{ background: tool.color }}
              onClick={() => navigate(`/lab?tool=${tool.slug}`)}
            >
              Launch Tool
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
