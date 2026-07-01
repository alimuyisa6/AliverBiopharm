// features/pdfs/PdfPreviewModal.jsx
import React from 'react';

export function PdfPreviewModal({ pdf, onClose, onDownload }) {
  if (!pdf) return null;

  return (
    <div className="pdf-preview-modal active" onClick={onClose}>
      <div className="pdf-preview-content" onClick={e => e.stopPropagation()}>
        <div className="pdf-preview-header">
          <h3>{pdf.title}</h3>
          <button className="pdf-preview-close" onClick={onClose}>&times;</button>
        </div>
        <div className="pdf-preview-body">
          <iframe src={pdf.file_url} frameBorder="0"></iframe>
        </div>
        <div className="pdf-preview-footer">
          <button className="pdf-preview-download-btn" onClick={() => onDownload(pdf)}>Download PDF</button>
          <button className="pdf-preview-back-btn" onClick={onClose}>Back to Library</button>
        </div>
      </div>
    </div>
  );
}
