import React, { useState, useEffect, useRef } from 'react';
import { fetchLabPathways, fetchLabPathway } from '../../api/client';

export default function BioPathways({ user }) {
  const [pathways, setPathways] = useState([]);
  const [selectedPathway, setSelectedPathway] = useState(null);
  const [pathwayData, setPathwayData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [level, setLevel] = useState('Alevel');
  const [loading, setLoading] = useState(true);
  const [pathwayLoading, setPathwayLoading] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetchLabPathways(level)
      .then(data => {
        setPathways(data || []);
        setSelectedPathway(null);
        setPathwayData(null);
        setCurrentStep(0);
      })
      .catch(() => setPathways([]))
      .finally(() => setLoading(false));
  }, [level]);

  const handlePathwaySelect = async (slug) => {
    setSelectedPathway(slug);
    setPathwayLoading(true);
    setCurrentStep(0);
    try {
      const data = await fetchLabPathway(slug);
      setPathwayData(data);
    } catch (e) {
      setPathwayData(null);
    }
    setPathwayLoading(false);
  };

  useEffect(() => {
    if (!svgRef.current || !pathwayData?.steps?.length) return;

    const svg = svgRef.current;
    const steps = pathwayData.steps;
    const width = 800;
    const height = 500;

    svg.innerHTML = '';

    steps.forEach((step, i) => {
      if (i < steps.length - 1) {
        const currentNode = step.svg_node_data || { x: 0, y: 0 };
        const nextNode = steps[i + 1].svg_node_data || { x: 0, y: 0 };

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', currentNode.x + 30);
        line.setAttribute('y1', currentNode.y + 15);
        line.setAttribute('x2', nextNode.x + 30);
        line.setAttribute('y2', nextNode.y + 15);
        line.setAttribute('stroke', i < currentStep ? 'var(--clr-cyan)' : 'rgba(255,255,255,0.2)');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        svg.appendChild(line);
      }
    });

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', 'var(--clr-cyan)');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.insertBefore(defs, svg.firstChild);

    steps.forEach((step, i) => {
      const nodeData = step.svg_node_data || { x: 50, y: 50 + i * 60, label: step.title, color: '#4caf50' };

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', nodeData.x);
      rect.setAttribute('y', nodeData.y);
      rect.setAttribute('width', '60');
      rect.setAttribute('height', '30');
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', i === currentStep ? nodeData.color : 'rgba(255,255,255,0.1)');
      rect.setAttribute('stroke', i === currentStep ? 'var(--clr-white)' : 'rgba(255,255,255,0.3)');
      rect.setAttribute('stroke-width', i === currentStep ? '3' : '1');

      if (i === currentStep) {
        rect.classList.add('lab-pathway-active-node');
      }

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', nodeData.x + 30);
      text.setAttribute('y', nodeData.y + 20);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'var(--clr-white)');
      text.setAttribute('font-size', '10px');
      text.setAttribute('font-weight', '600');
      text.textContent = (nodeData.label || step.title).substring(0, 10);

      g.appendChild(rect);
      g.appendChild(text);
      svg.appendChild(g);
    });
  }, [pathwayData, currentStep]);

  const totalSteps = pathwayData?.steps?.length || 0;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return (
    <div className="learning-lab">
      <div className="lab-tool-container">
        <div className="lab-tool-header">
          <h2 className="lab-tool-heading">
            <i className="fa-solid fa-dna"></i> BioPathways
          </h2>
          <p className="lab-tool-description">
            Walk through biological pathways step by step.
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
            <option value="alevel">A-Level</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
        </div>

        {loading ? (
          <div className="lab-loading">Loading pathways...</div>
        ) : !selectedPathway ? (
          <div className="lab-pathway-list">
            {pathways.map(pw => (
              <button
                key={pw.id}
                className="lab-pathway-card"
                onClick={() => handlePathwaySelect(pw.slug)}
              >
                <h3 className="lab-pathway-card-title">{pw.title}</h3>
                <p className="lab-pathway-card-desc">{pw.description}</p>
                <span className="lab-pathway-card-badge">{pw.level}</span>
              </button>
            ))}
          </div>
        ) : pathwayLoading ? (
          <div className="lab-loading">Loading pathway steps...</div>
        ) : pathwayData ? (
          <div className="lab-pathway-viewer">
            <button
              className="lab-back-btn lab-pathway-back"
              onClick={() => {
                setSelectedPathway(null);
                setPathwayData(null);
                setCurrentStep(0);
              }}
            >
              <i className="fa-solid fa-arrow-left"></i> All Pathways
            </button>

            <h3 className="lab-pathway-viewer-title">{pathwayData.title}</h3>

            <div className="lab-progress-bar-wrap">
              <div className="lab-progress-bar">
                <div
                  className="lab-progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <span className="lab-progress-text">
                Step {currentStep + 1} of {totalSteps}
              </span>
            </div>

            <div className="lab-graph-container lab-pathway-svg-container">
              <svg
                ref={svgRef}
                viewBox="0 0 800 500"
                className="lab-graph-svg"
              ></svg>
            </div>

            <div className="lab-step-panel">
              <div className="lab-step-content">
                <h4 className="lab-step-title">
                  {pathwayData.steps[currentStep]?.title}
                </h4>
                <p className="lab-step-description">
                  {pathwayData.steps[currentStep]?.description}
                </p>
              </div>
              <div className="lab-step-controls">
                <button
                  className="lab-step-btn"
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                >
                  <i className="fa-solid fa-chevron-left"></i> Previous
                </button>
                <button
                  className="lab-step-btn"
                  onClick={() => setCurrentStep(prev => Math.min(totalSteps - 1, prev + 1))}
                  disabled={currentStep >= totalSteps - 1}
                >
                  Next <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lab-empty-state">
            <i className="fa-solid fa-circle-exclamation lab-empty-icon"></i>
            <p>Failed to load pathway data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
