 import React from 'react';

export function PdfLibrarySection({ pdfs, onPreview, onDownload }) {
  const safePdfs = pdfs || [];

  if (safePdfs.length === 0) {
    return (
      <section id="pdf-library" className="section-wrapper pdf-library-wrapper">
        <div className="pdf-library-inner">
          <div className="pdf-library-heading">
            <span className="sec-label pdf-sec-label">PDF Resources</span>
            <h2 className="pdf-section-title pdf-gradient-title">Your Study Materials Library</h2>
            <p className="section-subtitle pdf-subtitle">
              Curated PDF resources for your level. Preview any document before downloading.
            </p>
          </div>
          <div className="pdf-main-container">
            <div className="pdf-content-wrapper">
              <div className="pdf-cards-area">
                <div className="pdf-empty-state">
                  <i className="fa-solid fa-file-pdf pdf-empty-icon"></i>
                  <p>No PDF resources available for your level yet.</p>
                  <span>Check back soon as new materials are added.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const topics = Array.from(new Set(safePdfs.map(p => p.topic || 'General')));

  return (
    <section id="pdf-library" className="section-wrapper pdf-library-wrapper">
      <div className="pdf-library-inner">
        <div className="pdf-library-heading">
          <span className="sec-label pdf-sec-label">PDF Resources</span>
          <h2 className="pdf-section-title pdf-gradient-title">Your Study Materials Library</h2>
          <p className="section-subtitle pdf-subtitle">
            Curated PDF resources for your level. Preview any document before downloading.
          </p>
        </div>
        <div className="pdf-main-container">
          <div className="pdf-content-wrapper">
            <div className="pdf-cards-area">
              {topics.map(topic => (
                <div key={topic} className="pdf-topic-group">
                  <h4 className="pdf-topic-heading">{topic}</h4>
                  <div className="pdf-cards-grid">
                    {safePdfs
                      .filter(p => (p.topic || 'General') === topic)
                      .map(pdf => (
                        <div
                          key={pdf.id}
                          className="pdf-card"
                          onClick={() => onPreview(pdf)}
                        >
                          <div className="pdf-card-icon">
                            <i className="fa-solid fa-file-pdf"></i>
                          </div>
                          <div className="pdf-card-title">
                            {pdf.title && pdf.title.length > 45
                              ? pdf.title.substring(0, 42) + '...'
                              : pdf.title || 'Untitled'}
                          </div>
                          <div className="pdf-card-author">
                            {pdf.author || 'Unknown'}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pdf-subtopics-column">
              <div className="pdf-subtopics-header">Browse Topics</div>
              <div className="pdf-subtopics-list">
                {topics.map(topic => (
                  <button
                    key={topic}
                    className="pdf-subtopic-item"
                    onClick={() => {
                      const el = document.querySelector(
                        `.pdf-topic-group:has(.pdf-topic-heading:contains("${topic}"))`
                      );
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    <div className="pdf-subtopic-title">{topic}</div>
                    <div className="pdf-subtopic-author">
                      {safePdfs.filter(p => (p.topic || 'General') === topic).length} resources
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
