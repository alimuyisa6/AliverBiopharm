// features/pdfs/PdfLibrarySection.jsx
import React from 'react';

export function PdfLibrarySection({ pdfs, pdfLevel, pdfSelectedTopic, onLevelChange, onTopicSelect, onPreview, onDownload }) {
  const levels = ['O-Level', 'A-Level', 'Pharmacy'];
  const safePdfs = pdfs || [];

  return (
    <section id="pdf-library" className="section-wrapper pdf-library-wrapper">
      <div className="pdf-library-inner">
        <div className="pdf-library-heading">
          <span className="sec-label pdf-sec-label">PDF Resources</span>
          <h2 className="pdf-section-title pdf-gradient-title">Your Study Materials Library</h2>
          <p className="section-subtitle pdf-subtitle">
            Curated PDF resources for Biology and Pharmacy. Preview any document before downloading.
          </p>
        </div>
        <div className="pdf-main-container">
          <div className="pdf-level-bar">
            {levels.map(level => (
              <button
                key={level}
                className={`pdf-level-btn ${pdfLevel === level ? 'active' : ''}`}
                onClick={() => onLevelChange(level)}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="pdf-content-wrapper">
            <div className="pdf-cards-area">
              {safePdfs.length === 0 ? (
                <div className="pdf-loading">No PDFs available for this level.</div>
              ) : (
                Array.from(new Set(safePdfs.map(p => p.topic || 'General'))).map(topic => (
                  <div key={topic} className="pdf-topic-group">
                    <h4 className="pdf-topic-heading">{topic}</h4>
                    <div className="pdf-cards-grid">
                      {safePdfs.filter(p => (p.topic || 'General') === topic).filter(Boolean).map(pdf => (
                        <div key={pdf.id} className="pdf-card" onClick={() => onPreview(pdf)}>
                          <div className="pdf-card-icon"><i className="fa-solid fa-file-pdf"></i></div>
                          <div className="pdf-card-title">{(pdf.title || '').length > 45 ? pdf.title.substring(0, 42) + '...' : pdf.title}</div>
                          <div className="pdf-card-author">{pdf.author || 'Unknown'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="pdf-subtopics-column">
              <div className="pdf-subtopics-header">Browse Topics</div>
              <div className="pdf-subtopics-list">
                {Array.from(new Set(safePdfs.map(p => p.topic || 'General'))).map(topic => (
                  <div
                    key={topic}
                    className={`pdf-subtopic-item ${pdfSelectedTopic === topic ? 'active' : ''}`}
                    onClick={() => onTopicSelect(topic)}
                  >
                    <div className="pdf-subtopic-title">{topic}</div>
                    <div className="pdf-subtopic-author">{safePdfs.filter(p => (p.topic || 'General') === topic).length} resources</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
