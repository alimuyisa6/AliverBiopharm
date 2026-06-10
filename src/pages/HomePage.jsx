import { useState, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import { useSiteData } from '../context/SiteDataContext';
import { apiCall } from '../services/apiService';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function ResourceModal({ resource, onClose }) {
  if (!resource) return null;
  return (
    <div className="resource-modal-overlay active" onClick={onClose}>
      <div className="resource-modal" onClick={e => e.stopPropagation()}>
        <button className="resource-modal-close" onClick={onClose}>✕</button>
        <h2>{escapeHtml(resource.title)}</h2>
        <p style={{ color: 'var(--clr-text-dim)', marginBottom: '1rem' }}>{escapeHtml(resource.description)}</p>
        <div>Author: {escapeHtml(resource.author || 'Unknown')}</div>
        <div>Level: {escapeHtml(resource.level || 'N/A')} | Category: {escapeHtml(resource.category || 'N/A')}</div>
        <div>File size: {escapeHtml(resource.file_size || 'N/A')}</div>
        {resource.file_url && (
          <a href={escapeHtml(resource.file_url)} className="btn-primary" download target="_blank" rel="noopener">
            <i className="fa-solid fa-download"></i> Download
          </a>
        )}
      </div>
    </div>
  );
}

function PdfPreviewModal({ isOpen, onClose, title, pdfUrl, onDownload }) {
  if (!isOpen) return null;
  return (
    <div className="pdf-preview-modal active">
      <div className="pdf-preview-content">
        <div className="pdf-preview-header">
          <h3 id="preview-title">{escapeHtml(title)}</h3>
          <button className="pdf-preview-close" onClick={onClose}>&times;</button>
        </div>
        <div className="pdf-preview-body" id="pdf-preview-body">
          {pdfUrl ? (
            <iframe src={pdfUrl} frameBorder="0" style={{ width: '100%', height: '100%' }}></iframe>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column' }}>
              <i className="fa-solid fa-file-pdf" style={{ fontSize: '4rem', color: '#e74c3c' }}></i>
              <h3>PDF File Not Available</h3>
            </div>
          )}
        </div>
        <div className="pdf-preview-footer">
          <button className="pdf-preview-download-btn" onClick={onDownload}>Download PDF</button>
          <button className="pdf-preview-back-btn" onClick={onClose}>Back to Library</button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const siteData = useSiteData();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [pdfPreview, setPdfPreview] = useState({ open: false, title: '', url: '' });
  const [resources, setResources] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const [filters, setFilters] = useState({ level: '', category: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardDecks, setFlashcardDecks] = useState({});
  const [flashcardState, setFlashcardState] = useState({ mode: 'study', currentDeck: null, currentCardIndex: 0, selectedLevel: '' });
  const [knownFlashcards, setKnownFlashcards] = useState([]);
  const [deckProgress, setDeckProgress] = useState({});
  const [pdfs, setPdfs] = useState([]);
  const [pdfTopics, setPdfTopics] = useState([]);
  const [pdfLevel, setPdfLevel] = useState('O-Level');
  const [selectedPdfTopic, setSelectedPdfTopic] = useState(null);
  const [notesStructure, setNotesStructure] = useState([]);
  const [notesLevel, setNotesLevel] = useState(null);
  const [notesTopic, setNotesTopic] = useState(null);
  const [notesContent, setNotesContent] = useState(null);
  const [showNotesFilter, setShowNotesFilter] = useState(false);
  const [communityActivity, setCommunityActivity] = useState([]);
  const [continueLearning, setContinueLearning] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [showMoodForm, setShowMoodForm] = useState(false);
  const [moodResponse, setMoodResponse] = useState('');
  const [weeklyChallenge, setWeeklyChallenge] = useState(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [faqItems, setFaqItems] = useState([]);
  const [contactInfo, setContactInfo] = useState([]);
  const [footerColumns, setFooterColumns] = useState([]);
  const [footerSocial, setFooterSocial] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [heroTitle, setHeroTitle] = useState({ main: 'Aliver Biopharm', sub: 'Advanced Biology & Pharmacy Learning Platform' });
  const [dailyFact, setDailyFact] = useState(null);

  const isAuthRef = useRef(isAuthenticated);
  useEffect(() => { isAuthRef.current = isAuthenticated; }, [isAuthenticated]);

  useEffect(() => {
    const loadData = async () => {
      if (siteData) {
        if (siteData.site_config?.logo_url) {
          document.querySelectorAll('.logo-link').forEach(el => {
            el.innerHTML = `<img src="${siteData.site_config.logo_url}" style="height:70px;width:auto;max-width:260px;object-fit:contain;" alt="AliverBiopharm">`;
          });
        }
        const headings = siteData.section_headings || {};
        Object.entries(headings).forEach(([id, text]) => {
          const el = document.getElementById(id);
          if (el) el.textContent = text;
        });
        if (siteData.hero?.slides) setHeroSlides(siteData.hero.slides);
        if (siteData.hero_title) {
          setHeroTitle({
            main: siteData.hero_title.main_title || 'Aliver Biopharm',
            sub: siteData.hero_title.sub_line || 'Advanced Biology & Pharmacy Learning Platform'
          });
        }
        if (siteData.weekly_challenge) setWeeklyChallenge(siteData.weekly_challenge);
        if (siteData.daily_facts?.length) {
          const today = new Date().toISOString().slice(0, 10);
          const fact = siteData.daily_facts.find(f => f.date === today) || siteData.daily_facts[siteData.daily_facts.length - 1];
          setDailyFact(fact);
        }
        if (siteData.team?.members) setTeamMembers(siteData.team.members);
        if (siteData.testimonials?.quotes) setTestimonials(siteData.testimonials.quotes);
        if (siteData.pricing?.plans) setPricingPlans(siteData.pricing.plans);
        if (siteData.blog?.posts) setBlogPosts(siteData.blog.posts);
        if (siteData.faq?.items) setFaqItems(siteData.faq.items);
        if (siteData.contact?.info) setContactInfo(siteData.contact.info);
        if (siteData.footer) {
          if (siteData.footer.columns) setFooterColumns(siteData.footer.columns);
          if (siteData.footer.social_links) setFooterSocial(siteData.footer.social_links);
        }
      }
      try {
        const resourceData = await apiCall('get_resources');
        if (resourceData) setResources(resourceData);
        const flashcardData = await apiCall('get_flashcards');
        if (flashcardData && Array.isArray(flashcardData)) {
          setFlashcards(flashcardData);
          const decks = {};
          flashcardData.forEach(card => {
            const cat = (card.category && String(card.category).trim()) || 'General';
            if (!decks[cat]) decks[cat] = [];
            decks[cat].push(card);
          });
          setFlashcardDecks(decks);
        }
        if (isAuthRef.current) {
          try {
            const known = await apiCall('get_known_flashcards');
            if (known) setKnownFlashcards(known);
            const progress = await apiCall('get_flashcard_progress');
            if (progress) setDeckProgress(progress);
          } catch (e) {}
        }
        const pdfData = await apiCall('get_pdfs_by_level', { level: pdfLevel });
        if (pdfData?.pdfs) {
          setPdfs(pdfData.pdfs);
          const topics = [...new Set(pdfData.pdfs.map(p => p.topic).filter(t => t))];
          setPdfTopics(topics);
        }
        const notesData = await apiCall('get_notes_structure');
        if (notesData && Array.isArray(notesData)) setNotesStructure(notesData);
        const activityData = await apiCall('get_community_activity');
        if (activityData) setCommunityActivity(activityData);
        if (isAuthRef.current) {
          const continueData = await Promise.allSettled([
            apiCall('get_recent_views', { limit: 3 }),
            apiCall('get_user_favorites'),
            apiCall('get_user_streak'),
            apiCall('get_user_achievements')
          ]);
          setContinueLearning({
            views: continueData[0].value || [],
            favorites: continueData[1].value || [],
            streak: continueData[2].value || { count: 0 },
            achievements: continueData[3].value || []
          });
        }
        const statsData = await apiCall('get_public_stats');
        if (statsData) setStats(statsData);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, [siteData, pdfLevel, isAuthRef]);

  useEffect(() => {
    const filtered = resources.filter(r => {
      const matchSearch = !searchTerm || (r.title || '').toLowerCase().includes(searchTerm) || (r.description || '').toLowerCase().includes(searchTerm);
      const matchLevel = !filters.level || r.level === filters.level;
      const matchCategory = !filters.category || r.category === filters.category;
      return matchSearch && matchLevel && matchCategory;
    });
    setFilteredResources(filtered);
  }, [resources, searchTerm, filters]);

  const handlePdfLevelChange = async (level) => {
    setPdfLevel(level);
    setSelectedPdfTopic(null);
    const data = await apiCall('get_pdfs_by_level', { level });
    if (data?.pdfs) {
      setPdfs(data.pdfs);
      const topics = [...new Set(data.pdfs.map(p => p.topic).filter(t => t))];
      setPdfTopics(topics);
    }
  };

  const filterPdfsByTopic = (topic) => {
    setSelectedPdfTopic(topic);
    const filtered = pdfs.filter(p => (p.topic || 'General') === topic);
    const cardsArea = document.getElementById('pdf-cards-area');
    if (cardsArea) {
      cardsArea.innerHTML = renderPdfCards(filtered);
    }
  };

  const renderPdfCards = (pdfList) => {
    const grouped = {};
    pdfList.forEach(pdf => {
      const topic = pdf.topic || 'General';
      if (!grouped[topic]) grouped[topic] = [];
      grouped[topic].push(pdf);
    });
    let html = '';
    for (const [topic, items] of Object.entries(grouped)) {
      html += `<div class="pdf-topic-group" data-topic="${escapeHtml(topic)}"><h4>${escapeHtml(topic)}</h4><div class="pdf-cards-grid">`;
      for (const pdf of items) {
        html += `<div class="pdf-card" data-pdf-id="${pdf.id}" data-pdf-title="${escapeHtml(pdf.title)}" data-pdf-author="${escapeHtml(pdf.author || 'Unknown')}" data-pdf-url="${escapeHtml(pdf.file_url)}">
          <div class="pdf-card-icon"><i class="fa-solid fa-file-pdf"></i></div>
          <div class="pdf-card-title">${escapeHtml(pdf.title.length > 45 ? pdf.title.substring(0, 42) + '...' : pdf.title)}</div>
          <div class="pdf-card-author">${escapeHtml(pdf.author || 'Unknown')}</div>
        </div>`;
      }
      html += `</div></div>`;
    }
    return html;
  };

  const handlePdfCardClick = async (pdfId, pdfTitle, pdfUrl) => {
    if (!isAuthRef.current) {
      alert('Please sign in to access PDF resources.');
      return;
    }
    const userChoice = confirm(`📄 ${pdfTitle}\n\n✅ OK to Preview\n❌ Cancel to Download`);
    if (userChoice) {
      setPdfPreview({ open: true, title: pdfTitle, url: pdfUrl });
      await apiCall('track_pdf_preview', { pdf_id: pdfId });
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = pdfTitle.replace(/[^a-z0-9]/gi, '_') + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await apiCall('track_pdf_download', { pdf_id: pdfId });
    }
  };

  const submitWeeklyChallenge = async (selectedIdx) => {
    if (!isAuthRef.current) return;
    const isCorrect = selectedIdx === weeklyChallenge.correct;
    setQuizResult({ correct: isCorrect, correctOption: weeklyChallenge.correct, explanation: weeklyChallenge.explanation });
    setQuizAnswered(true);
    try {
      await apiCall('submit_weekly_challenge', { week_start: weeklyChallenge.week_start, selected_option: selectedIdx });
    } catch (e) {}
  };

  const submitMood = async () => {
    if (!selectedMood || !isAuthRef.current) return;
    try {
      await apiCall('submit_mood', { mood: selectedMood, message: moodMessage });
      setShowMoodForm(false);
      setMoodResponse("Thanks for sharing! We're here to help.");
      setTimeout(() => {
        setSelectedMood(null);
        setMoodResponse('');
        setMoodMessage('');
      }, 5000);
    } catch (e) { alert('Failed to submit mood.'); }
  };

  const loadNotes = async (level, topic, subtopicId, subtopicName) => {
    const data = await apiCall('get_note_content', { subtopic_id: subtopicId });
    setNotesContent(data);
  };

  const renderResourcesGrid = () => {
    const groups = {};
    filteredResources.forEach(item => {
      const s = (item.section_type || 'Resources').trim();
      if (!groups[s]) groups[s] = [];
      groups[s].push(item);
    });
    let html = '';
    for (const [name, items] of Object.entries(groups)) {
      html += `<div style="margin-bottom:3rem;">
        <h2 style="font-family:'Poppins',sans-serif;font-size:1.6rem;color:var(--clr-cyan);margin-bottom:1.25rem;padding-left:1rem;border-left:4px solid var(--clr-magenta);">${escapeHtml(name)}</h2>
        <div class="resources-grid">`;
      for (const item of items) {
        const fileIcon = (item.file_url || '').toLowerCase().endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file';
        html += `<div class="resource-card" data-id="${item.id}">
          <div style="font-size:2.2rem;color:var(--clr-magenta);"><i class="fa-solid ${fileIcon}"></i></div>
          <a href="#" class="resource-title-link" style="font-weight:700;font-size:1.05rem;color:var(--clr-white);text-decoration:none;">${escapeHtml(item.title || 'Untitled')}</a>
          <p style="font-size:0.9rem;color:var(--clr-text-dim);flex-grow:1;">${escapeHtml(item.description || '')}</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.6rem;font-size:0.8rem;color:var(--clr-text-muted);">
            <span><i class="fa-regular fa-user"></i> ${escapeHtml(item.author || 'Unknown')}</span>
            <span><i class="fa-regular fa-calendar"></i> ${new Date(item.created_at).toLocaleDateString()}</span>
            <span><i class="fa-regular fa-file"></i> ${escapeHtml(item.file_size || 'N/A')}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:1rem;border-top:1px solid var(--clr-border-glow);">
            <a href="${escapeHtml(item.file_url || '#')}" class="btn-download" download target="_blank" rel="noopener"><i class="fa-solid fa-download"></i> Download</a>
            <div style="display:flex;gap:0.4rem;">
              <a href="#" class="share-btn" aria-label="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></a>
              <a href="#" class="share-btn" aria-label="Share on X"><i class="fa-brands fa-x-twitter"></i></a>
              <a href="#" class="share-btn" aria-label="Share on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
            </div>
          </div>
        </div>`;
      }
      html += `</div></div>`;
    }
    return html;
  };

  useEffect(() => {
    const resourcesContainer = document.getElementById('resources-container');
    if (resourcesContainer) {
      resourcesContainer.innerHTML = renderResourcesGrid();
      resourcesContainer.querySelectorAll('.resource-title-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const card = link.closest('.resource-card');
          if (card) {
            const id = parseInt(card.dataset.id);
            const resource = resources.find(r => r.id === id);
            setSelectedResource(resource);
          }
        });
      });
    }
  }, [filteredResources]);

  useEffect(() => {
    const pdfCardsArea = document.getElementById('pdf-cards-area');
    if (pdfCardsArea) {
      pdfCardsArea.innerHTML = renderPdfCards(pdfs);
      pdfCardsArea.querySelectorAll('.pdf-card').forEach(card => {
        card.addEventListener('click', () => {
          const pdfId = card.dataset.pdfId;
          const pdfTitle = card.dataset.pdfTitle;
          const pdfUrl = card.dataset.pdfUrl;
          handlePdfCardClick(pdfId, pdfTitle, pdfUrl);
        });
      });
    }
  }, [pdfs]);

  useEffect(() => {
    const topicsList = document.getElementById('pdf-subtopics-list');
    if (topicsList && pdfTopics.length) {
      topicsList.innerHTML = pdfTopics.map(topic => `<div class="pdf-subtopic-item" data-topic="${escapeHtml(topic)}">
        <div class="pdf-subtopic-title">${escapeHtml(topic)}</div>
        <div class="pdf-subtopic-author">${pdfs.filter(p => (p.topic || 'General') === topic).length} resources</div>
      </div>`).join('');
      topicsList.querySelectorAll('.pdf-subtopic-item').forEach(item => {
        item.addEventListener('click', () => {
          filterPdfsByTopic(item.dataset.topic);
        });
      });
    }
  }, [pdfTopics, pdfs]);

  return (
    <>
      <section id="home" className="hero-carousel" aria-label="Hero carousel">
        <div className="carousel-slide active" style={{ background: 'linear-gradient(135deg,#0a4f4f,#0e7070)' }}>
          <div className="slide-overlay">
            <h1 className="font-display font-black text-4xl md:text-6xl mb-4 hero-title">Welcome to AliverBiopharm</h1>
            <p className="text-lg md:text-xl max-w-2xl mb-8 hero-subtitle">Advanced Biology & Pharmacy Learning Platform</p>
            <a href="#courses" className="btn-primary"><i className="fa-solid fa-arrow-right"></i> Explore Resources</a>
          </div>
        </div>
      </section>

      <section id="hero-title-section" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '0' }}>
        <div className="dynamic-hero-container">
          <h1 className="dynamic-main-title">
            {heroTitle.main.split(' ').map((word, i) => (
              <span key={i} className={`title-word ${i % 2 === 0 ? 'magenta-word' : 'cyan-word'}`}>{word}</span>
            ))}
          </h1>
          <div className="title-sub-line">
            {heroTitle.sub.split(' ').map((word, i) => {
              if (word === '&') return <span key={i} className="sub-word magenta-word">&amp;</span>;
              if (word === 'Biology' || word === 'Pharmacy') return <span key={i} className="sub-word cyan-word">{word}</span>;
              return <span key={i} className="sub-word">{word}</span>;
            })}
          </div>
        </div>
      </section>

      <section id="daily-fact" className="section reveal" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
        {dailyFact && (
          <div className="daily-fact-card">
            <div className="daily-fact-icon"><i className="fa-solid fa-flask"></i></div>
            <div>
              <p style={{ fontWeight: '700', color: 'var(--clr-cyan)' }}>SCIENCE FACT OF THE DAY</p>
              <p style={{ color: 'var(--clr-white)' }}>{escapeHtml(dailyFact.fact)}</p>
              <small style={{ color: 'var(--clr-text-muted)' }}>Source: {escapeHtml(dailyFact.source || 'Unknown')}</small>
            </div>
          </div>
        )}
        {weeklyChallenge && (
          <div className="weekly-challenge-card">
            <div className="challenge-badge">WEEKLY CHALLENGE</div>
            <h3 style={{ fontFamily: "'Poppins',sans-serif", color: 'var(--clr-cyan)', marginBottom: '0.5rem' }}>
              <i className="fa-solid fa-trophy" style={{ color: 'var(--clr-magenta)' }}></i> {escapeHtml(weeklyChallenge.question)}
            </h3>
            {!isAuthenticated ? (
              <p style={{ textAlign: 'center', color: 'var(--clr-text-dim)' }}>Sign in to attempt the weekly challenge.</p>
            ) : quizAnswered ? (
              <p style={{ textAlign: 'center', color: 'var(--clr-white)', marginTop: '0.5rem' }}>
                <i className={`fa-solid fa-${quizResult.correct ? 'check-circle' : 'times-circle'}`} style={{ color: quizResult.correct ? '#0ab5b5' : '#e74c3c' }}></i>
                {quizResult.correct ? 'Correct!' : 'Incorrect.'} {String.fromCharCode(65 + weeklyChallenge.correct)}) {weeklyChallenge.options[weeklyChallenge.correct]}
                <br /><small style={{ color: 'var(--clr-text-dim)' }}>{escapeHtml(quizResult.explanation)}</small>
              </p>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                {weeklyChallenge.options.map((opt, i) => (
                  <button key={i} className="quiz-option-btn" onClick={() => submitWeeklyChallenge(i)}>
                    {String.fromCharCode(65 + i)}) {escapeHtml(opt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section id="mood-check" className="section reveal" style={{ paddingTop: '20px', paddingBottom: '20px' }}>
        <div className="mood-section">
          <h3 style={{ textAlign: 'center', color: 'var(--clr-white)', marginBottom: '.5rem' }}>
            <i className="fa-solid fa-face-smile" style={{ color: 'var(--clr-magenta)' }}></i> How are you feeling about your studies?
          </h3>
          <div className="mood-emojis">
            {['struggling', 'confused', 'okay', 'good', 'great'].map(m => (
              <button key={m} className={`mood-emoji ${selectedMood === m ? 'selected' : ''}`} data-mood={m} onClick={() => { setSelectedMood(m); setShowMoodForm(true); setMoodResponse(''); }}>
                {m === 'struggling' ? '😭' : m === 'confused' ? '🤔' : m === 'okay' ? '😐' : m === 'good' ? '😊' : '🚀'}
              </button>
            ))}
          </div>
          {showMoodForm && (
            <div style={{ textAlign: 'center' }}>
              <textarea value={moodMessage} onChange={e => setMoodMessage(e.target.value)} placeholder="Tell us more (optional)..." style={{ width: '100%', maxWidth: '400px', padding: '8px', borderRadius: '10px', background: 'rgba(10,181,181,.05)', color: 'var(--clr-white)' }}></textarea>
              <br /><button className="btn-primary" onClick={submitMood} style={{ marginTop: '8px' }}>Submit <i className="fa-solid fa-paper-plane"></i></button>
            </div>
          )}
          {moodResponse && <div style={{ textAlign: 'center', color: 'var(--clr-cyan)', marginTop: '8px' }}>{moodResponse}</div>}
        </div>
      </section>

      <section id="continue-learning" className="section reveal" style={{ display: isAuthenticated ? 'block' : 'none' }}>
        <span className="sec-label">YOUR JOURNEY</span>
        <h2 className="section-title">Continue Learning</h2>
        <div className="continue-learning-grid">
          {continueLearning?.streak?.count > 0 && (
            <div className="continue-card"><i className="fa-solid fa-fire" style={{ color: 'var(--clr-magenta)' }}></i> <strong>{continueLearning.streak.count}-Day Streak</strong><p style={{ fontSize: '0.8rem' }}>Keep it up!</p></div>
          )}
          {continueLearning?.views?.length > 0 && (
            <div className="continue-card"><strong>Recent Views</strong><ul style={{ listStyle: 'none', marginTop: '0.4rem' }}>{continueLearning.views.map(v => <li key={v.resource_id}>{escapeHtml(v.title)}</li>)}</ul></div>
          )}
          {continueLearning?.favorites?.length > 0 && (
            <div className="continue-card"><strong>Favorites</strong><ul style={{ listStyle: 'none', marginTop: '0.4rem' }}>{continueLearning.favorites.slice(0, 3).map(f => <li key={f.resource_id}>{escapeHtml(f.title)}</li>)}</ul></div>
          )}
          {continueLearning?.achievements?.length > 0 && (
            <div className="continue-card"><strong>Achievements</strong><div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>{continueLearning.achievements.map(a => <span title={escapeHtml(a.badge)} style={{ fontSize: '1.4rem' }}>🏅</span>)}</div></div>
          )}
        </div>
      </section>

      <section id="team" className="section reveal">
        <span className="sec-label">FACULTY</span>
        <h2 className="section-title">Meet Our Expert Faculty</h2>
        <p className="section-subtitle">Learn from distinguished pharmacologists and molecular biologists.</p>
        <div className="team-scroll-container">
          {teamMembers.map(member => (
            <div key={member.name} className="team-card" style={{ minWidth: '280px', maxWidth: '320px' }}>
              <div className="team-avatar">{member.avatar_url ? <img src={member.avatar_url} alt={member.name} /> : <i className="fa-solid fa-user-tie"></i>}</div>
              <h3>{escapeHtml(member.name)}</h3>
              <div className="team-title">{escapeHtml(member.title || 'Faculty Member')}</div>
              <p>{escapeHtml(member.bio || '')}</p>
              <div className="team-social">
                {member.linkedin && <a href={member.linkedin} target="_blank" rel="noopener"><i className="fa-brands fa-linkedin-in"></i></a>}
                {member.twitter && <a href={member.twitter} target="_blank" rel="noopener"><i className="fa-brands fa-x-twitter"></i></a>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="testimonials" className="section alt-bg reveal">
        <span className="sec-label">TESTIMONIALS</span>
        <h2 className="section-title">Learner Success Stories</h2>
        <p className="section-subtitle">Hear from students who transformed their understanding of biology and pharmacy.</p>
        <div className="testimonial-slider">
          {testimonials.length > 0 && (
            <>
              <blockquote className="testimonial-quote">"{escapeHtml(testimonials[0]?.text)}"</blockquote>
              <cite className="testimonial-author">— {escapeHtml(testimonials[0]?.author)}</cite>
            </>
          )}
        </div>
      </section>

      <section id="courses" className="section reveal">
        <span className="sec-label">LEARNING TOOLS</span>
        <h2 className="section-title">Learning Resources</h2>
        <p className="section-subtitle">Browse our comprehensive library of biology and pharmacy materials.</p>
        <div className="filter-bar">
          <div className="filter-bar-inner">
            <button className="filter-toggle-btn" onClick={() => document.getElementById('filter-dropdown').style.display = document.getElementById('filter-dropdown').style.display === 'none' ? 'flex' : 'none'}>
              <i className="fa-solid fa-filter"></i> Filter Resources <i className="fa-solid fa-chevron-down"></i>
            </button>
            <div id="filter-dropdown" className="filter-dropdown" style={{ display: 'none' }}>
              <input type="text" className="f-input" placeholder="Search resources..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div className="filter-accordion">
                <button className="filter-accordion-btn"><span>Level</span><span className="filter-selected">All Levels</span><i className="fa-solid fa-chevron-down"></i></button>
                <div className="filter-options">
                  <label className="filter-option"><input type="radio" name="level" value="" checked={!filters.level} onChange={() => setFilters({ ...filters, level: '' })} /> All Levels</label>
                  <label className="filter-option"><input type="radio" name="level" value="O-Level" onChange={() => setFilters({ ...filters, level: 'O-Level' })} /> O-Level</label>
                  <label className="filter-option"><input type="radio" name="level" value="A-Level" onChange={() => setFilters({ ...filters, level: 'A-Level' })} /> A-Level</label>
                  <label className="filter-option"><input type="radio" name="level" value="Pharmacy" onChange={() => setFilters({ ...filters, level: 'Pharmacy' })} /> Pharmacy</label>
                </div>
              </div>
              <button className="filter-clear-btn" onClick={() => { setFilters({ level: '', category: '' }); setSearchTerm(''); }}>Clear All</button>
            </div>
          </div>
        </div>
        <div id="resources-container"></div>
      </section>

      <section id="flashcards" className="section reveal">
        <span className="sec-label">STUDY TOOLS</span>
        <h2 className="section-title">Flashcard Decks</h2>
        <p className="section-subtitle">Active recall is the most effective way to retain complex scientific concepts.</p>
        <div className="flashcard-filter">
          <i className="fa-solid fa-filter"></i>
          <label>Filter by Level:</label>
          <select onChange={e => setFlashcardState({ ...flashcardState, selectedLevel: e.target.value })}>
            <option value="">All Levels</option>
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="Pharmacy">Pharmacy</option>
          </select>
        </div>
        <div id="flashcards-container">
          {Object.entries(flashcardDecks).map(([deckName, cards]) => (
            <div key={deckName} className="flashcard-category">
              <h3><i className="fa-solid fa-layer-group"></i> {deckName}</h3>
              <div className="flashcard-grid">
                {cards.slice(0, 3).map(card => (
                  <div key={card.id} className="flashcard-deck">
                    <div className="flashcard-face">
                      <div className="front">{card.front_text}</div>
                      <div className="back">{card.back_text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="pdf-library" className="section reveal" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label">PDF RESOURCES</span>
            <h2 className="pdf-section-title">Study Materials Library</h2>
            <p className="section-subtitle">Access comprehensive PDF resources for Biology and Pharmacy. Preview before downloading.</p>
          </div>
          <div className="pdf-main-container">
            <div className="pdf-level-bar">
              {['O-Level', 'A-Level', 'Pharmacy'].map(level => (
                <button key={level} className={`pdf-level-btn ${pdfLevel === level ? 'active' : ''}`} onClick={() => handlePdfLevelChange(level)}>{level}</button>
              ))}
            </div>
            <div className="pdf-content-wrapper">
              <div id="pdf-cards-area" className="pdf-cards-area"></div>
              <div className="pdf-subtopics-column">
                <div className="pdf-subtopics-header">Browse Topics</div>
                <div id="pdf-subtopics-list" className="pdf-subtopics-list"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="notes-section" className="section-wrapper" style={{ margin: '60px 0', padding: '0 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <span className="sec-label">STUDY NOTES</span>
            <h2 className="pdf-section-title">Notes Library</h2>
            <p className="section-subtitle">Comprehensive study notes for Biology and Pharmacy.</p>
          </div>
          <div style={{ background: 'var(--clr-navy-card)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px' }}>
              <button className="btn-primary" onClick={() => setShowNotesFilter(!showNotesFilter)}><i className="fa-solid fa-filter"></i> Browse Notes by Level</button>
              {showNotesFilter && (
                <div style={{ marginTop: '20px' }}>
                  <div id="notes-level-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {[...new Set(notesStructure.map(n => n.level))].map(level => (
                      <button key={level} className="level-btn" onClick={() => setNotesLevel(level)}>{level}</button>
                    ))}
                  </div>
                  {notesLevel && (
                    <div id="notes-topics-container">
                      {[...new Set(notesStructure.filter(n => n.level === notesLevel).map(n => n.topic))].map(topic => (
                        <button key={topic} className="topic-btn" onClick={() => setNotesTopic(topic)}>{topic}</button>
                      ))}
                    </div>
                  )}
                  {notesTopic && (
                    <div id="notes-subtopics-container">
                      {notesStructure.filter(n => n.level === notesLevel && n.topic === notesTopic).map(sub => (
                        <div key={sub.subtopic_id} className="subtopic-card" onClick={() => loadNotes(notesLevel, notesTopic, sub.subtopic_id, sub.subtopic_name)}>
                          <h3>{sub.subtopic_name}</h3>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div id="notes-container" style={{ marginTop: '20px' }}>
                {notesContent && <div dangerouslySetInnerHTML={{ __html: notesContent.content }} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="section alt-bg reveal">
        <span className="sec-label">COMMUNITY</span>
        <h2 className="section-title">Live Learning Stream</h2>
        <div className="community-stream">
          {communityActivity.map((act, i) => (
            <div key={i} className="stream-item">
              <i className={`fa-solid fa-${act.type === 'download' ? 'download' : 'graduation-cap'}`}></i>
              <span>{escapeHtml(act.message)}</span>
              <small style={{ marginLeft: 'auto' }}>{new Date(act.time).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="section alt-bg reveal">
        <span className="sec-label">MEMBERSHIP</span>
        <h2 className="section-title">Membership Plans</h2>
        <p className="section-subtitle">Choose the plan that fits your learning journey.</p>
        <div className="grid-3">
          {pricingPlans.map(plan => (
            <div key={plan.name} className={`card pricing-card ${plan.featured ? 'featured' : ''}`}>
              <h3>{escapeHtml(plan.name)}</h3>
              <p>{escapeHtml(plan.description)}</p>
              <div className="price">{escapeHtml(plan.price)}<span>{escapeHtml(plan.period)}</span></div>
              <ul className="pricing-features">{plan.features?.map(f => <li key={f}><i className="fa-solid fa-check"></i> {escapeHtml(f)}</li>)}</ul>
              <button className="btn-primary">{escapeHtml(plan.cta_text || 'Subscribe')}</button>
            </div>
          ))}
        </div>
      </section>

      <section id="stats" className="section reveal">
        <span className="sec-label">IMPACT</span>
        <h2 className="section-title">Our Impact in Numbers</h2>
        <div className="stats-grid">
          <div><div className="stat-number">{stats?.resources_count || 0}</div><div>Resources</div></div>
          <div><div className="stat-number">{stats?.users_count || 0}</div><div>Learners</div></div>
          <div><div className="stat-number">{stats?.downloads_count || 0}</div><div>Downloads</div></div>
          <div><div className="stat-number">{stats?.quiz_attempts || 0}</div><div>Quiz Attempts</div></div>
        </div>
      </section>

      <section id="blog" className="section alt-bg reveal">
        <span className="sec-label">INSIGHTS</span>
        <h2 className="section-title">Latest Articles & Insights</h2>
        <p className="section-subtitle">Stay informed with the latest developments in biology and pharmacy.</p>
        <div className="grid-3">
          {blogPosts.map(post => (
            <article key={post.title} className="card">
              {post.image_url && <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }} />}
              <h3>{escapeHtml(post.title)}</h3>
              <p>{escapeHtml(post.excerpt)}</p>
              <a href="#">Read Article <i className="fa-solid fa-arrow-right"></i></a>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="section reveal">
        <span className="sec-label">FAQ</span>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-subtitle">Quick answers to common questions.</p>
        <div className="faq-list">
          {faqItems.map((item, i) => (
            <div key={i} className="faq-item">
              <button className="faq-question" onClick={e => e.currentTarget.parentElement.classList.toggle('active')}>
                <span>{escapeHtml(item.question)}</span><span>+</span>
              </button>
              <div className="faq-answer"><p>{escapeHtml(item.answer)}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="section alt-bg reveal">
        <span className="sec-label">SUPPORT</span>
        <h2 className="section-title">Get in Touch</h2>
        <p className="section-subtitle">Have questions or feedback? Our support team typically responds within 24 hours.</p>
        <div className="grid-2">
          <form id="contact-form" onSubmit={async e => {
            e.preventDefault();
            const formData = {
              name: document.getElementById('contact-name').value.trim(),
              email: document.getElementById('contact-email').value.trim(),
              subject: document.getElementById('contact-subject').value.trim(),
              message: document.getElementById('contact-message').value.trim()
            };
            try {
              await apiCall('submit_contact', { formData });
              alert('Message sent successfully!');
              e.target.reset();
            } catch (err) {
              alert('Failed to send message.');
            }
          }}>
            <input type="text" id="contact-name" className="f-input" placeholder="Full name" required />
            <input type="email" id="contact-email" className="f-input" placeholder="Email" required />
            <input type="text" id="contact-subject" className="f-input" placeholder="Subject" required />
            <textarea id="contact-message" className="f-input" placeholder="Your message" style={{ minHeight: '110px' }} required></textarea>
            <button type="submit" className="f-btn">Send Message <i className="fa-solid fa-paper-plane"></i></button>
          </form>
          <aside className="contact-info-card">
            {contactInfo.map(info => (
              <div key={info.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0', borderBottom: '1px solid var(--clr-border-glow)' }}>
                <div className="contact-icon"><i className={info.icon}></i></div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{info.label}</div>
                  <a href={info.href} style={{ color: 'var(--clr-white)', textDecoration: 'none' }}>{info.value}</a>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section className="section reveal">
        <span className="sec-label">UPDATES</span>
        <h2 className="section-title">Stay Updated</h2>
        <p className="section-subtitle">Join our community of learners. Get weekly insights, study tips, and new resource alerts.</p>
        <form id="newsletter-form" onSubmit={async e => {
          e.preventDefault();
          const email = e.target.querySelector('input').value.trim();
          try {
            await apiCall('subscribe_newsletter', { formData: { email } });
            alert('Subscribed successfully!');
            e.target.reset();
          } catch (err) {
            alert('Subscription failed.');
          }
        }}>
          <div className="newsletter-box">
            <input type="email" placeholder="Enter your email address" required />
            <button type="submit">Subscribe <i className="fa-solid fa-paper-plane"></i></button>
          </div>
        </form>
      </section>

      <button className="back-to-top" id="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <i className="fa-solid fa-arrow-up"></i>
      </button>

      <a href="#pricing" className="sticky-cta"><i className="fa-solid fa-rocket"></i> Start Learning</a>

      {selectedResource && <ResourceModal resource={selectedResource} onClose={() => setSelectedResource(null)} />}
      <PdfPreviewModal
        isOpen={pdfPreview.open}
        onClose={() => setPdfPreview({ open: false, title: '', url: '' })}
        title={pdfPreview.title}
        pdfUrl={pdfPreview.url}
        onDownload={() => {
          const link = document.createElement('a');
          link.href = pdfPreview.url;
          link.download = pdfPreview.title.replace(/[^a-z0-9]/gi, '_') + '.pdf';
          link.click();
        }}
      />
    </>
  );
}
