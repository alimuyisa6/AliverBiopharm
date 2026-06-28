import React, { useState, useEffect } from 'react';
import { fetchLabTools } from '../../api/client';

export default function LabHome({ user, navigate }) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLabTools()
      .then(data => setTools(data || []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="learning-lab">
        <div className="lab-home-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="lab-tool-card lab-tool-card-skeleton">
              <div className="lab-tool-card-shimmer"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tools.length) {
    return (
      <div className="learning-lab">
        <div className="lab-empty-state">
          <i className="fa-solid fa-flask lab-empty-icon"></i>
          <p>No learning tools available yet.</p>
        </div>
      </div>
    );
  }

  const handleToolClick = (slug) => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/lab?tool=${slug}`);
  };

  return (
    <div className="learning-lab">
      <div className="lab-home-grid">
        {tools.map(tool => (
          <div
            key={tool.id}
            className="lab-tool-card"
            style={{ borderTopColor: tool.color }}
          >
            <div className="lab-tool-icon-wrap" style={{ color: tool.color }}>
              <i className={`fa-solid ${tool.icon}`}></i>
            </div>
            <h3 className="lab-tool-title">{tool.title}</h3>
            <p className="lab-tool-subtitle">{tool.subtitle}</p>
            <button
              className="lab-tool-btn"
              style={{
                background: user ? tool.color : 'var(--clr-magenta)',
                borderColor: tool.color
              }}
              onClick={() => handleToolClick(tool.slug)}
            >
              {user ? 'Launch Tool' : 'Login to Access'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
