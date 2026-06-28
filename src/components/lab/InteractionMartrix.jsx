import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { fetchLabDrugs, fetchLabInteraction } from '../../api/client';

const SEVERITY_COLORS = {
  minor: '#4caf50',
  moderate: '#ff9800',
  severe: '#f44336'
};

export default function InteractionMatrix({ user }) {
  const [drugs, setDrugs] = useState([]);
  const [selectedDrugs, setSelectedDrugs] = useState([]);
  const [level, setLevel] = useState('pharmacy');
  const [interactions, setInteractions] = useState([]);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetchLabDrugs(level)
      .then(data => {
        setDrugs(data || []);
        setSelectedDrugs([]);
        setInteractions([]);
        setSelectedEdge(null);
      })
      .catch(() => setDrugs([]))
      .finally(() => setLoading(false));
  }, [level]);

  const handleDrugToggle = (drugId) => {
    setSelectedDrugs(prev => {
      if (prev.includes(drugId)) {
        return prev.filter(id => id !== drugId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, drugId];
    });
    setSelectedEdge(null);
  };

  const loadInteractions = useCallback(async () => {
    if (selectedDrugs.length < 2) {
      setInteractions([]);
      return;
    }
    setInteractionLoading(true);
    const results = [];
    for (let i = 0; i < selectedDrugs.length; i++) {
      for (let j = i + 1; j < selectedDrugs.length; j++) {
        try {
          const interaction = await fetchLabInteraction(selectedDrugs[i], selectedDrugs[j]);
          if (interaction) {
            results.push({
              ...interaction,
              sourceId: selectedDrugs[i],
              targetId: selectedDrugs[j]
            });
          }
        } catch (e) {
          console.error('Failed to fetch interaction:', e);
        }
      }
    }
    setInteractions(results);
    setInteractionLoading(false);
  }, [selectedDrugs]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  useEffect(() => {
    if (!svgRef.current || selectedDrugs.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 600;
    const height = 400;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const selectedDrugObjects = drugs.filter(d => selectedDrugs.includes(d.id));

    const nodes = selectedDrugObjects.map((d, i) => ({
      id: d.id,
      name: d.name,
      drug_class: d.drug_class,
      x: width / 2 + (width / 3) * Math.cos((2 * Math.PI * i) / selectedDrugObjects.length - Math.PI / 2),
      y: height / 2 + (height / 3) * Math.sin((2 * Math.PI * i) / selectedDrugObjects.length - Math.PI / 2)
    }));

    const links = interactions.map(interaction => ({
      source: nodes.find(n => n.id === interaction.sourceId),
      target: nodes.find(n => n.id === interaction.targetId),
      severity: interaction.severity,
      mechanism: interaction.mechanism,
      clinical_note: interaction.clinical_note
    }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    const linkGroup = svg.append('g');

    const link = linkGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => SEVERITY_COLORS[d.severity] || '#888')
      .attr('stroke-width', 3)
      .attr('stroke-opacity', 0.8)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedEdge(d);
      });

    const nodeGroup = svg.append('g');

    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer');

    node.append('circle')
      .attr('r', 30)
      .attr('fill', d => {
        const colorMap = {
          'NSAID': '#e91e63',
          'Anticoagulant': '#f44336',
          'Biguanide': '#4caf50',
          'Penicillin': '#2196f3'
        };
        return colorMap[d.drug_class] || 'var(--clr-cyan)';
      })
      .attr('stroke', 'var(--clr-white)')
      .attr('stroke-width', 2);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('fill', 'var(--clr-white)')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(d => d.name.substring(0, 8));

    node.append('title')
      .text(d => `${d.name} (${d.drug_class})`);

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    svg.on('click', () => setSelectedEdge(null));

    return () => simulation.stop();
  }, [interactions, drugs, selectedDrugs]);

  return (
    <div className="learning-lab">
      <div className="lab-tool-container">
        <div className="lab-tool-header">
          <h2 className="lab-tool-heading">
            <i className="fa-solid fa-circle-nodes"></i> Interaction Matrix
          </h2>
          <p className="lab-tool-description">
            Select up to 3 drugs to visualize their interactions.
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
        </div>

        {loading ? (
          <div className="lab-loading">Loading drugs...</div>
        ) : (
          <>
            <div className="lab-drug-selector">
              <p className="lab-selector-hint">
                {selectedDrugs.length < 2
                  ? 'Select at least 2 drugs to see interactions'
                  : `${selectedDrugs.length} drug${selectedDrugs.length > 1 ? 's' : ''} selected`}
              </p>
              <div className="lab-drug-chips">
                {drugs.map(drug => (
                  <button
                    key={drug.id}
                    className={`lab-drug-chip ${selectedDrugs.includes(drug.id) ? 'active' : ''}`}
                    onClick={() => handleDrugToggle(drug.id)}
                    disabled={!selectedDrugs.includes(drug.id) && selectedDrugs.length >= 3}
                  >
                    {drug.name}
                    <span className="lab-drug-chip-class">{drug.drug_class}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-interaction-area">
              <div className="lab-graph-container">
                {selectedDrugs.length < 2 ? (
                  <div className="lab-graph-placeholder">
                    <i className="fa-solid fa-diagram-project lab-graph-placeholder-icon"></i>
                    <p>Select at least 2 drugs to visualize interactions</p>
                  </div>
                ) : interactionLoading ? (
                  <div className="lab-loading">Loading interactions...</div>
                ) : (
                  <svg ref={svgRef} className="lab-graph-svg"></svg>
                )}
              </div>

              {selectedEdge && (
                <div className="lab-edge-panel">
                  <h3 className="lab-edge-panel-title">
                    Interaction Details
                    <button
                      className="lab-edge-panel-close"
                      onClick={() => setSelectedEdge(null)}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </h3>
                  <div className="lab-edge-severity">
                    <span
                      className="lab-edge-severity-badge"
                      style={{ background: SEVERITY_COLORS[selectedEdge.severity] || '#888' }}
                    >
                      {selectedEdge.severity?.toUpperCase()}
                    </span>
                  </div>
                  <div className="lab-edge-detail">
                    <strong>Mechanism:</strong>
                    <p>{selectedEdge.me
