 import React from 'react';

export function NotesSection({
  groupedNotes,
  notesContent,
  notesReactions,
  notesComments,
  notesCommentInput,
  onReadNote,
  onReaction,
  onComment,
  onCommentInputChange
}) {
  const safeGroupedNotes = groupedNotes || {};
  const safeNotesComments = notesComments || [];
  const hasNotes = Object.keys(safeGroupedNotes).length > 0;

  if (!hasNotes) {
    return (
      <section id="notes-section" className="section-wrapper notes-wrapper">
        <div className="notes-inner">
          <div className="notes-heading">
            <span className="sec-label notes-sec-label">Study Notes</span>
            <h2 className="pdf-section-title notes-gradient-title">Structured Notes for Serious Students</h2>
            <p className="section-subtitle notes-subtitle">
              Organised by topic. Everything you need for focused, efficient revision.
            </p>
          </div>
          <div className="notes-container-card">
            <div className="notes-container-inner">
              <div className="notes-empty-state">
                <i className="fa-solid fa-book-open notes-empty-icon"></i>
                <p>No study notes available for your level yet.</p>
                <span>Check back soon as new notes are added.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="notes-section" className="section-wrapper notes-wrapper">
      <div className="notes-inner">
        <div className="notes-heading">
          <span className="sec-label notes-sec-label">Study Notes</span>
          <h2 className="pdf-section-title notes-gradient-title">Structured Notes for Serious Students</h2>
          <p className="section-subtitle notes-subtitle">
            Organised by topic. Everything you need for focused, efficient revision.
          </p>
        </div>
        <div className="notes-container-card">
          <div className="notes-container-inner">
            {!notesContent ? (
              <div className="notes-topics-grid">
                {Object.keys(safeGroupedNotes).map(topic => (
                  <div key={topic} className="notes-topic-group">
                    <h4 className="notes-topic-heading">{topic}</h4>
                    <div className="notes-subtopics-grid-inner">
                      {(safeGroupedNotes[topic] || [])
                        .filter(Boolean)
                        .map(item => (
                          <div key={item.subtopic_id} className="subtopic-card">
                            <div className="subtopic-card-inner">
                              <span className="topic-badge">{topic}</span>
                              <h3 className="subtopic-name">{item.subtopic_name}</h3>
                              <p className="subtopic-preview">
                                {item.content_preview ||
                                  item.subtopic_preview ||
                                  'Comprehensive study notes covering key concepts.'}
                              </p>
                              <button
                                className="read-note-btn"
                                onClick={() => onReadNote(item.subtopic_id)}
                              >
                                <i className="fa-solid fa-book-open-reader"></i> Read This Note
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notes-content-area">
                <button
                  className="notes-back-btn"
                  onClick={() => onReadNote(null)}
                >
                  <i className="fa-solid fa-arrow-left"></i> Back to Notes
                </button>
                <div className="notes-content-container">
                  <h1>{notesContent.subtopicName || notesContent.title || 'Note'}</h1>
                  <div
                    className="notes-content"
                    dangerouslySetInnerHTML={{
                      __html: notesContent.content || '<p>No content available.</p>'
                    }}
                  />
                  <div className="notes-reaction-bar">
                    <button
                      className={`reaction-btn ${
                        notesReactions?.user_reaction === 'like' ? 'active' : ''
                      }`}
                      onClick={() => onReaction(notesContent.subtopicId, 'like')}
                    >
                      <i className="fa-regular fa-thumbs-up"></i>
                      <span className="reaction-count">{notesReactions?.counts?.like || 0}</span>
                    </button>
                    <button
                      className={`reaction-btn ${
                        notesReactions?.user_reaction === 'love' ? 'active' : ''
                      }`}
                      onClick={() => onReaction(notesContent.subtopicId, 'love')}
                    >
                      <i className="fa-regular fa-heart"></i>
                      <span>{notesReactions?.counts?.love || 0}</span>
                    </button>
                    <button
                      className={`reaction-btn ${
                        notesReactions?.user_reaction === 'helpful' ? 'active' : ''
                      }`}
                      onClick={() => onReaction(notesContent.subtopicId, 'helpful')}
                    >
                      <i className="fa-regular fa-lightbulb"></i>
                      <span>{notesReactions?.counts?.helpful || 0}</span>
                    </button>
                  </div>
                  <div className="comment-section">
                    <div className="comment-input-group">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Add a comment..."
                        value={notesCommentInput}
                        onChange={e => onCommentInputChange(e.target.value)}
                      />
                      <button
                        className="btn-primary"
                        onClick={() => onComment(notesContent.subtopicId)}
                      >
                        Post
                      </button>
                    </div>
                    <div className="comment-list">
                      {safeNotesComments.filter(Boolean).map((c, idx) => (
                        <div key={idx} className="comment-item">
                          <strong>{c.user_name || 'User'}</strong>
                          <span className="comment-date">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                          <br />
                          {c.comment}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
