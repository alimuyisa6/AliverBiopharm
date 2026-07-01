// features/notes/NotesSection.jsx
import React from 'react';

export function NotesSection({ groupedNotes, notesSelectedLevel, notesSelectedTopic, notesFilterVisible, notesContent, notesReactions, notesComments, notesCommentInput, onSelectLevel, onSelectTopic, onToggleFilter, onReadNote, onReaction, onComment, onCommentInputChange }) {
  const safeGroupedNotes = groupedNotes || {};
  const safeNotesComments = notesComments || [];

  const getLevelColor = (level) => {
    if (level === 'O-Level') return '#0ab5b5';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#10b981';
    return 'var(--clr-cyan)';
  };

  return (
    <section id="notes-section" className="section-wrapper notes-wrapper">
      <div className="notes-inner">
        <div className="notes-heading">
          <span className="sec-label notes-sec-label">Study Notes</span>
          <h2 className="pdf-section-title notes-gradient-title">Structured Notes for Serious Students</h2>
          <p className="section-subtitle notes-subtitle">
            Organised by level, topic, and subtopic. Everything you need for focused, efficient revision.
          </p>
        </div>
        <div className="notes-container-card">
          <div className="notes-container-inner">
            <button className="btn-primary notes-filter-btn" onClick={onToggleFilter}>
              <i className="fa-solid fa-filter"></i> Browse Notes by Level
            </button>
            {notesFilterVisible && (
              <div id="notes-filter-area">
                <div id="notes-level-buttons" className="notes-level-buttons">
                  {Object.keys(safeGroupedNotes).map(level => (
                    <button
                      key={level}
                      className="level-btn"
                      style={{
                        background: notesSelectedLevel === level ? 'var(--clr-cyan)' : 'transparent',
                        border: `2px solid ${getLevelColor(level)}`,
                        color: notesSelectedLevel === level ? '#fff' : 'var(--clr-white)',
                        padding: '8px 24px',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      onClick={() => onSelectLevel(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {notesSelectedLevel && (
                  <div id="notes-topics-container" className="notes-topics-container">
                    <h4 className="notes-topics-heading"><i className="fa-solid fa-folder-tree"></i> Topics</h4>
                    <div className="notes-topics-list">
                      {Object.keys(safeGroupedNotes[notesSelectedLevel] || {}).map(topic => (
                        <button
                          key={topic}
                          className="topic-btn"
                          style={{
                            background: notesSelectedTopic === topic ? 'var(--clr-magenta)' : 'rgba(184,135,58,0.15)',
                            border: '1px solid var(--clr-magenta)',
                            color: notesSelectedTopic === topic ? '#fff' : 'var(--clr-magenta)',
                            padding: '6px 18px',
                            borderRadius: '50px',
                            cursor: 'pointer',
                          }}
                          onClick={() => onSelectTopic(topic)}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {notesSelectedTopic && (
                  <div id="notes-subtopics-container">
                    <h4 className="notes-subtopics-heading"><i className="fa-solid fa-file-lines"></i> Study Notes</h4>
                    <div className="notes-subtopics-grid">
                      {(safeGroupedNotes[notesSelectedLevel]?.[notesSelectedTopic] || []).filter(Boolean).map(item => (
                        <div key={item.subtopic_id} className="subtopic-card">
                          <div className="subtopic-card-inner">
                            <span className="topic-badge">{notesSelectedTopic}</span>
                            <h3 className="subtopic-name">{item.subtopic_name}</h3>
                            <p className="subtopic-preview">{item.subtopic_preview || 'Comprehensive study notes covering key concepts.'}</p>
                            <button className="read-note-btn" onClick={() => onReadNote(item.subtopic_id)}>
                              <i className="fa-solid fa-book-open-reader"></i> Read This Note
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {notesContent && (
              <div id="notes-content-area" className="notes-content-area">
                <div className="notes-content-container">
                  <h1>{notesContent.subtopicName}</h1>
                  <div dangerouslySetInnerHTML={{ __html: notesContent.content || '<p>No content available.</p>' }} />
                  <div className="notes-reaction-bar">
                    <button className={`reaction-btn ${notesReactions?.user_reaction === 'like' ? 'active' : ''}`} onClick={() => onReaction(notesContent.subtopicId, 'like')}>
                      <i className="fa-regular fa-thumbs-up"></i> <span className="reaction-count">{notesReactions?.counts?.like || 0}</span>
                    </button>
                    <button className={`reaction-btn ${notesReactions?.user_reaction === 'love' ? 'active' : ''}`} onClick={() => onReaction(notesContent.subtopicId, 'love')}>
                      <i className="fa-regular fa-heart"></i> <span>{notesReactions?.counts?.love || 0}</span>
                    </button>
                    <button className={`reaction-btn ${notesReactions?.user_reaction === 'helpful' ? 'active' : ''}`} onClick={() => onReaction(notesContent.subtopicId, 'helpful')}>
                      <i className="fa-regular fa-lightbulb"></i> <span>{notesReactions?.counts?.helpful || 0}</span>
                    </button>
                  </div>
                  <div className="comment-section">
                    <div className="comment-input-group">
                      <input type="text" className="form-input" placeholder="Add a comment..." value={notesCommentInput} onChange={e => onCommentInputChange(e.target.value)} />
                      <button className="btn-primary" onClick={() => onComment(notesContent.subtopicId)}>Post</button>
                    </div>
                    <div className="comment-list">
                      {safeNotesComments.filter(Boolean).map(c => (
                        <div key={c.created_at} className="comment-item">
                          <strong>{c.user_name}</strong> <span className="comment-date">{new Date(c.created_at).toLocaleDateString()}</span><br />{c.comment}
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
