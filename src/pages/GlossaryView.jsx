 import { Link } from 'react-router-dom';

export default function GlossaryView({
  user,
  selectedLevel,
  selectedClass,
  terms,
  categories,
  selectedCategory,
  searchQuery,
  activeTerm,
  termContent,
  loading,
  termLoading,
  sidebarOpen,
  groupedTerms,
  getLevelColor,
  onCategoryChange,
  onSearchChange,
  onTermClick,
  onToggleSidebar,
  onClearSearch
}) {
  if (loading && terms.length === 0) {
    return (
      <div className="glossary-loading-wrap">
        <div className="pdf-loading-spinner">
          <div className="spinner-dot dot-magenta"></div>
          <div className="spinner-dot dot-cyan"></div>
          <div className="spinner-dot dot-orange"></div>
        </div>
      </div>
    );
  }

  const levelColor = getLevelColor(selectedLevel);

  return (
    <div className="glossary-page">
      <div className="glossary-header">
        <div className="glossary-header-inner">
          <h1 className="glossary-main-title">
            <span className="title-word magenta-word">Biology</span>
            <span className="title-word cyan-word">Glossary</span>
          </h1>
          <p className="glossary-subtitle">
            Master every term with linked quizzes, notes, flashcards, and past papers — all in one place.
          </p>
          {selectedClass && (
            <div className="glossary-class-badge" style={{ '--badge-accent': levelColor }}>
              <span className="glossary-class-badge-label">Class:</span>
              <span className="glossary-class-badge-value">{selectedClass}</span>
            </div>
          )}
        </div>
      </div>

      <div className="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house breadcrumb-icon"></i> Home</Link>
        <span>›</span>
        <span>Glossary</span>
      </div>

      <div className="glossary-main-layout">
        <button
          className="glossary-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <i className={`fa-solid fa-${sidebarOpen ? 'chevron-left' : 'chevron-right'}`}></i>
          <span>{sidebarOpen ? 'Hide' : 'Show'} Terms</span>
        </button>

        <div className={`glossary-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="glossary-sidebar-inner" style={{ '--sidebar-accent': levelColor }}>
            <div className="glossary-search-area">
              <div className="glossary-search-input-wrap">
                <i className="fa-solid fa-magnifying-glass glossary-search-icon"></i>
                <input
                  type="text"
                  className="glossary-search-input"
                  placeholder="Search terms..."
                  value={searchQuery}
                  onChange={e => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="glossary-search-clear"
                    onClick={onClearSearch}
                    aria-label="Clear search"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              <div className="glossary-category-filter">
                <select
                  className="glossary-category-select"
                  value={selectedCategory}
                  onChange={e => onCategoryChange(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="glossary-terms-list">
              {loading ? (
                <div className="glossary-loading-state">
                  <div className="glossary-loading-spinner">
                    <div className="spinner-dot dot-magenta"></div>
                    <div className="spinner-dot dot-cyan"></div>
                    <div className="spinner-dot dot-orange"></div>
                  </div>
                  <p>Loading terms...</p>
                </div>
              ) : Object.keys(groupedTerms).length === 0 ? (
                <div className="glossary-empty-state">
                  <i className="fa-solid fa-book-open"></i>
                  <p>No terms found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
                  {searchQuery && (
                    <button className="btn-primary" onClick={onClearSearch}>
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                Object.entries(groupedTerms).map(([category, categoryTerms]) => (
                  <div key={category} className="glossary-term-group">
                    <h3 className="glossary-category-heading">{category}</h3>
                    {categoryTerms.map(term => (
                      <button
                        key={term.id}
                        className={`glossary-term-btn ${activeTerm?.id === term.id ? 'active' : ''}`}
                        onClick={() => onTermClick(term)}
                        style={{ '--term-accent': activeTerm?.id === term.id ? levelColor : 'transparent' }}
                      >
                        <span className="glossary-term-btn-text">{term.term}</span>
                        <span className="glossary-term-btn-arrow">
                          <i className="fa-solid fa-chevron-right"></i>
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={`glossary-content ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
          {!activeTerm ? (
            <div className="glossary-welcome">
              <div className="glossary-welcome-icon">
                <i className="fa-solid fa-dna"></i>
              </div>
              <h2>Select a term to begin</h2>
              <p>Choose any term from the sidebar to see its definition, linked quizzes, study notes, flashcards, and more.</p>
              <div className="glossary-welcome-stats">
                <div className="glossary-welcome-stat stat-cyan">
                  <span className="glossary-welcome-stat-number">{terms.length}</span>
                  <span className="glossary-welcome-stat-label">Terms</span>
                </div>
                <div className="glossary-welcome-stat stat-magenta">
                  <span className="glossary-welcome-stat-number">{Object.keys(groupedTerms).length}</span>
                  <span className="glossary-welcome-stat-label">Categories</span>
                </div>
                <div className="glossary-welcome-stat stat-blue">
                  <span className="glossary-welcome-stat-number">{selectedClass || selectedLevel}</span>
                  <span className="glossary-welcome-stat-label">Class</span>
                </div>
              </div>
            </div>
          ) : termLoading ? (
            <div className="glossary-loading-state glossary-term-loading">
              <div className="glossary-loading-spinner">
                <div className="spinner-dot dot-magenta"></div>
                <div className="spinner-dot dot-cyan"></div>
                <div className="spinner-dot dot-orange"></div>
              </div>
              <p>Loading {activeTerm.term}...</p>
            </div>
          ) : termContent ? (
            <div className="glossary-term-detail">
              <div className="glossary-term-hero" style={{ '--hero-accent': levelColor }}>
                <div className="glossary-term-breadcrumb">
                  <span className="glossary-term-category-badge">
                    {termContent.term.category}
                  </span>
                  {termContent.term.pronunciation && (
                    <span className="glossary-term-pronunciation">
                      <i className="fa-solid fa-volume-high"></i> {termContent.term.pronunciation}
                    </span>
                  )}
                </div>

                <h2 className="glossary-term-title">{termContent.term.term}</h2>

                <div className="glossary-term-definitions">
                  <div className="glossary-definition-plain">
                    <p>{termContent.term.plain_definition}</p>
                  </div>
                  {termContent.term.technical_definition && (
                    <div className="glossary-definition-technical">
                      <h4>
                        <i className="fa-solid fa-microscope"></i> Technical Definition
                      </h4>
                      <p>{termContent.term.technical_definition}</p>
                    </div>
                  )}
                </div>

                {(termContent.term.etymology || termContent.term.mnemonic) && (
                  <div className="glossary-term-meta">
                    {termContent.term.etymology && (
                      <div className="glossary-meta-item meta-etymology">
                        <span className="glossary-meta-label">
                          <i className="fa-solid fa-language"></i> Etymology
                        </span>
                        <span className="glossary-meta-value">{termContent.term.etymology}</span>
                      </div>
                    )}
                    {termContent.term.mnemonic && (
                      <div className="glossary-meta-item meta-mnemonic">
                        <span className="glossary-meta-label">
                          <i className="fa-solid fa-lightbulb"></i> Memory Aid
                        </span>
                        <span className="glossary-meta-value">{termContent.term.mnemonic}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="glossary-routes">
                {termContent.content.quizzes && termContent.content.quizzes.length > 0 && (
                  <div className="glossary-route-section route-quiz">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-circle-question"></i>
                      <h3>Quizzes</h3>
                      <span className="glossary-route-count">{termContent.content.quizzes.length}</span>
                    </div>
                    <div className="glossary-route-grid">
                      {termContent.content.quizzes.map(quiz => (
                        <Link
                          key={quiz.id}
                          to={`/quiz?topic=${encodeURIComponent(quiz.subject || quiz.category || '')}`}
                          className="glossary-route-card"
                        >
                          <div className="glossary-route-card-icon quiz-icon">
                            <i className="fa-solid fa-circle-question"></i>
                          </div>
                          <div className="glossary-route-card-body">
                            <h4>{quiz.title}</h4>
                            <span className="glossary-route-card-meta">
                              {quiz.difficulty && `${quiz.difficulty} · `}{quiz.subject || quiz.category}
                            </span>
                          </div>
                          <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {termContent.content.pdfs && termContent.content.pdfs.length > 0 && (
                  <div className="glossary-route-section route-pdf">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-file-pdf"></i>
                      <h3>PDF Resources</h3>
                      <span className="glossary-route-count">{termContent.content.pdfs.length}</span>
                    </div>
                    <div className="glossary-route-grid">
                      {termContent.content.pdfs.map(pdf => (
                        <a
                          key={pdf.id}
                          href={pdf.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glossary-route-card"
                        >
                          <div className="glossary-route-card-icon pdf-icon">
                            <i className="fa-solid fa-file-pdf"></i>
                          </div>
                          <div className="glossary-route-card-body">
                            <h4>{pdf.title}</h4>
                            <span className="glossary-route-card-meta">
                              {pdf.author && `${pdf.author} · `}{pdf.topic}
                            </span>
                          </div>
                          <i className="fa-solid fa-download glossary-route-card-arrow"></i>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {termContent.content.notes && termContent.content.notes.length > 0 && (
                  <div className="glossary-route-section route-notes">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-file-lines"></i>
                      <h3>Study Notes</h3>
                      <span className="glossary-route-count">{termContent.content.notes.length}</span>
                    </div>
                    <div className="glossary-route-grid">
                      {termContent.content.notes.map(note => (
                        <Link
                          key={note.subtopic_id}
                          to={`/notes/read?id=${note.subtopic_id}`}
                          className="glossary-route-card"
                        >
                          <div className="glossary-route-card-icon note-icon">
                            <i className="fa-solid fa-file-lines"></i>
                          </div>
                          <div className="glossary-route-card-body">
                            <h4>{note.subtopic_name}</h4>
                            <span className="glossary-route-card-meta">
                              {note.topic}{note.read_time && ` · ${note.read_time}`}
                            </span>
                          </div>
                          <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {termContent.content.flashcards && termContent.content.flashcards.length > 0 && (
                  <div className="glossary-route-section route-flashcard">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-layer-group"></i>
                      <h3>Flashcard Decks</h3>
                      <span className="glossary-route-count">{termContent.content.flashcards.length}</span>
                    </div>
                    <div className="glossary-route-grid">
                      {termContent.content.flashcards.map(deck => (
                        <Link
                          key={deck.id}
                          to="/flashcards"
                          className="glossary-route-card"
                        >
                          <div className="glossary-route-card-icon flashcard-icon">
                            <i className="fa-solid fa-layer-group"></i>
                          </div>
                          <div className="glossary-route-card-body">
                            <h4>{deck.title}</h4>
                            <span className="glossary-route-card-meta">{deck.category}</span>
                          </div>
                          <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {termContent.content.past_papers && termContent.content.past_papers.length > 0 && (
                  <div className="glossary-route-section route-paper">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-file-signature"></i>
                      <h3>Past Papers</h3>
                      <span className="glossary-route-count">{termContent.content.past_papers.length}</span>
                    </div>
                    <div className="glossary-route-grid">
                      {termContent.content.past_papers.map(paper => (
                        <Link
                          key={paper.id}
                          to="/past-papers"
                          className="glossary-route-card"
                        >
                          <div className="glossary-route-card-icon paper-icon">
                            <i className="fa-solid fa-file-signature"></i>
                          </div>
                          <div className="glossary-route-card-body">
                            <h4>{paper.title}</h4>
                            <span className="glossary-route-card-meta">
                              {paper.subject} · {paper.year}
                            </span>
                          </div>
                          <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {termContent.content.recall_questions && termContent.content.recall_questions.length > 0 && (
                  <div className="glossary-route-section route-recall">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-brain"></i>
                      <h3>Recall Practice</h3>
                      <span className="glossary-route-count">{termContent.content.recall_questions.length}</span>
                    </div>
                    <div className="glossary-route-grid">
                      {termContent.content.recall_questions.map(q => (
                        <Link
                          key={q.id}
                          to={`/recall?topic=${encodeURIComponent(q.topic || '')}`}
                          className="glossary-route-card"
                        >
                          <div className="glossary-route-card-icon recall-icon">
                            <i className="fa-solid fa-brain"></i>
                          </div>
                          <div className="glossary-route-card-body">
                            <h4>{q.question_text && q.question_text.length > 80 ? q.question_text.substring(0, 77) + '...' : q.question_text}</h4>
                            <span className="glossary-route-card-meta">
                              {q.topic}{q.difficulty && ` · ${q.difficulty}`}
                            </span>
                          </div>
                          <i className="fa-solid fa-arrow-right glossary-route-card-arrow"></i>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {termContent.term.related_terms_data && termContent.term.related_terms_data.length > 0 && (
                  <div className="glossary-route-section route-related">
                    <div className="glossary-route-header">
                      <i className="fa-solid fa-link"></i>
                      <h3>Related Terms</h3>
                    </div>
                    <div className="glossary-related-terms">
                      {termContent.term.related_terms_data.map(related => (
                        <button
                          key={related.slug}
                          className="glossary-related-term-btn"
                          onClick={() => {
                            const relatedTerm = {
                              id: related.slug,
                              term: related.term,
                              slug: related.slug,
                              plain_definition: related.plain_definition
                            };
                            onTermClick(relatedTerm);
                          }}
                        >
                          <span>{related.term}</span>
                          <i className="fa-solid fa-arrow-right"></i>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
