import React, { useState, useEffect } from 'react';
import HomeView from './HomeView';
import { getSections } from '../data/sections';
import { getFlashcards, getKnownFlashcards, getFlashcardDecks, getFlashcardProgress } from '../api/client';
import { getPdfsByLevel } from '../api/client';
import { getNotesStructure, getNoteContent, getNoteReactions, toggleNoteReaction, getResourceInteractions, commentResource } from '../api/client';
import { getPublicStats, getCommunityActivity, getContinueReading } from '../api/client';
import { getUserDashboard, getUserFavorites, getRecentViews, getUserStreak } from '../api/client';
import { getQuizTopics } from '../api/client';
import { getWeeklyChallengeStatus, submitWeeklyChallenge } from '../api/client';
import { submitMood } from '../api/client';
import { submitContact, subscribeNewsletter } from '../api/client';
import { requestChat, getChatMessages, sendChatMessage, deleteChatMessage, checkAdminOnline } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [sections, setSections] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardDecks, setFlashcardDecks] = useState([]);
  const [flashcardShuffled, setFlashcardShuffled] = useState({});
  const [knownFlashcardIds, setKnownFlashcardIds] = useState([]);
  const [flashcardMode, setFlashcardMode] = useState('study');
  const [flashcardCurrentDeck, setFlashcardCurrentDeck] = useState(null);
  const [flashcardCurrentIndex, setFlashcardCurrentIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState({});
  const [flashcardSelectedLevel, setFlashcardSelectedLevel] = useState('');
  const [flashcardDeckProgress, setFlashcardDeckProgress] = useState({});
  const [pdfs, setPdfs] = useState([]);
  const [pdfLevel, setPdfLevel] = useState('O-Level');
  const [pdfSelectedTopic, setPdfSelectedTopic] = useState(null);
  const [notesStructure, setNotesStructure] = useState(null);
  const [notesSelectedLevel, setNotesSelectedLevel] = useState(null);
  const [notesSelectedTopic, setNotesSelectedTopic] = useState(null);
  const [notesFilterVisible, setNotesFilterVisible] = useState(false);
  const [publicStats, setPublicStats] = useState(null);
  const [communityActivity, setCommunityActivity] = useState([]);
  const [weeklyChallengeAnswer, setWeeklyChallengeAnswer] = useState(null);
  const [moodSelected, setMoodSelected] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [continueLearning, setContinueLearning] = useState({ views: [], favorites: [], streak: 0 });
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const [theme, setTheme] = useState('light');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [notesContent, setNotesContent] = useState(null);
  const [notesReactions, setNotesReactions] = useState(null);
  const [notesComments, setNotesComments] = useState([]);
  const [notesCommentInput, setNotesCommentInput] = useState('');
  const [groupedNotes, setGroupedNotes] = useState({});
  const chatBodyRef = React.useRef(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    getSections().then(setSections).catch(() => {});
    getPublicStats().then(setPublicStats).catch(() => {});
    getCommunityActivity().then(setCommunityActivity).catch(() => {});
    getFlashcards().then(setFlashcards).catch(() => {});
    getFlashcardDecks().then(setFlashcardDecks).catch(() => {});
    getKnownFlashcards().then(setKnownFlashcardIds).catch(() => {});
    getFlashcardProgress().then(setFlashcardDeckProgress).catch(() => {});
    getPdfsByLevel('O-Level').then(res => setPdfs(res?.pdfs || [])).catch(() => {});
    getNotesStructure().then(data => {
      setNotesStructure(data);
      const grouped = {};
      (data || []).filter(Boolean).forEach(item => {
        if (!grouped[item.level]) grouped[item.level] = {};
        if (!grouped[item.level][item.topic]) grouped[item.level][item.topic] = [];
        grouped[item.level][item.topic].push(item);
      });
      setGroupedNotes(grouped);
    }).catch(() => {});
    if (user) {
      getContinueReading().then(data => setContinueLearning({ views: data || [], favorites: [], streak: 0 })).catch(() => {});
      getUserFavorites().then(favs => setContinueLearning(prev => ({ ...prev, favorites: favs || [] }))).catch(() => {});
      getUserStreak().then(res => setContinueLearning(prev => ({ ...prev, streak: res?.count || 0 }))).catch(() => {});
    }
    checkAdminOnline().then(res => setAdminOnline(res?.online)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (flashcards.length > 0) {
      const shuffled = {};
      flashcards.filter(Boolean).forEach(card => {
        const deckName = card.category || 'General';
        if (!shuffled[deckName]) shuffled[deckName] = [];
        shuffled[deckName].push(card);
      });
      Object.keys(shuffled).forEach(key => {
        shuffled[key] = shuffleArray(shuffled[key]);
      });
      setFlashcardShuffled(shuffled);
    }
  }, [flashcards]);

  useEffect(() => {
    if (!sections?.hero?.slides?.length) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % sections.hero.slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [sections]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      setTheme('dark');
    }
  }, []);

  function getLevelColor(level) {
    if (level === 'O-Level') return '#0ab5b5';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#10b981';
    return 'var(--clr-cyan)';
  }

  async function handleWeeklyChallengeSubmit(i, correct, explanation) {
    if (!user) return;
    setWeeklyChallengeAnswer({ correct: i === correct, explanation });
    try {
      await submitWeeklyChallenge(new Date().toISOString().slice(0, 10), i);
    } catch (e) { console.error(e); }
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    try {
      await submitContact(contactForm);
      setContactStatus({ success: true, message: 'Message sent successfully!' });
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (e) {
      setContactStatus({ success: false, message: e.message });
    }
  }

  async function handleNewsletterSubmit(e) {
    e.preventDefault();
    if (!newsletterEmail) return;
    try {
      await subscribeNewsletter(newsletterEmail);
      setNewsletterStatus({ success: true, message: 'Subscribed successfully!' });
      setNewsletterEmail('');
    } catch (e) {
      setNewsletterStatus({ success: false, message: e.message });
    }
  }

  async function handleMoodSubmit() {
    if (!moodSelected) return;
    try {
      await submitMood(moodSelected, moodMessage);
      setMoodSubmitted(true);
    } catch (e) { console.error(e); }
  }

  function shuffleFlashcards() {
    setFlashcardShuffled(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = shuffleArray(next[key]);
      });
      return next;
    });
  }

  function toggleCardFlip(cardId, deckName, idx) {
    setFlippedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
    setFlashcardCurrentIndex(idx);
    setFlashcardCurrentDeck(deckName);
  }

  async function fetchPdfsByLevel(level) {
    try {
      const res = await getPdfsByLevel(level);
      setPdfs(res?.pdfs || []);
    } catch (e) { console.error(e); }
  }

  function handlePdfPreview(pdf) {
    setPreviewPdf(pdf);
    setPdfPreviewOpen(true);
  }

  function handlePdfDownload(pdf) {
    window.open(pdf.file_url, '_blank');
  }

  async function loadNoteContent(subtopicId) {
    try {
      const content = await getNoteContent(subtopicId);
      const reactions = await getNoteReactions(subtopicId);
      const interactions = await getResourceInteractions(subtopicId);
      setNotesContent({ ...content, subtopicId, subtopicName: content?.title || content?.subtopic_name });
      setNotesReactions(reactions);
      setNotesComments(interactions?.comments || []);
    } catch (e) { console.error(e); }
  }

  async function handleNoteReaction(noteId, reactionType) {
    if (!user) return;
    try {
      await toggleNoteReaction(noteId, reactionType);
      const updated = await getNoteReactions(noteId);
      setNotesReactions(updated);
    } catch (e) { console.error(e); }
  }

  async function handleNoteComment(noteId) {
    if (!user || !notesCommentInput.trim()) return;
    try {
      await commentResource(noteId, notesCommentInput);
      setNotesCommentInput('');
      const interactions = await getResourceInteractions(noteId);
      setNotesComments(interactions?.comments || []);
    } catch (e) { console.error(e); }
  }

  function toggleKnown(cardId) {
    setKnownFlashcardIds(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      return [...prev, cardId];
    });
  }

  async function rateFlashcard(cardId, difficulty) {
    try {
      const { rateFlashcard: apiRate } = await import('../api/client');
      await apiRate(cardId, difficulty);
    } catch (e) { console.error(e); }
  }

  async function checkFlashcardAnswer(cardId, userAnswer) {
    try {
      const { checkFlashcardAnswer: apiCheck } = await import('../api/client');
      return await apiCheck(cardId, userAnswer);
    } catch (e) { return { correct: false, correct_answer: 'Error' }; }
  }

  async function toggleFlashcardBookmark(cardId) {
    try {
      const { toggleFlashcardBookmark: apiToggle } = await import('../api/client');
      await apiToggle(cardId);
    } catch (e) { console.error(e); }
  }

  function speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }

  async function requestChatRoom() {
    if (!user) return;
    try {
      const res = await requestChat();
      setChatRoomId(res?.room_id);
      setChatOpen(true);
      if (res?.room_id) {
        const messages = await getChatMessages(res.room_id);
        setChatMessages(messages || []);
      }
    } catch (e) { console.error(e); }
  }

  async function sendChat() {
    if (!chatInput.trim() || !chatRoomId) return;
    try {
      await sendChatMessage(chatRoomId, chatInput);
      setChatInput('');
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(messages || []);
    } catch (e) { console.error(e); }
  }

  async function deleteChatMsg(msgId) {
    try {
      await deleteChatMessage(msgId);
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(messages || []);
    } catch (e) { console.error(e); }
  }

  const navigate = React.useMemo(() => (path) => window.location.href = path, []);

  return (
    <HomeView
      sections={sections}
      flashcards={flashcards}
      flashcardDecks={flashcardDecks}
      flashcardShuffled={flashcardShuffled}
      knownFlashcardIds={knownFlashcardIds}
      flashcardMode={flashcardMode}
      flashcardCurrentDeck={flashcardCurrentDeck}
      flashcardCurrentIndex={flashcardCurrentIndex}
      flippedCards={flippedCards}
      flashcardSelectedLevel={flashcardSelectedLevel}
      flashcardDeckProgress={flashcardDeckProgress}
      pdfs={pdfs}
      pdfLevel={pdfLevel}
      pdfSelectedTopic={pdfSelectedTopic}
      notesStructure={notesStructure}
      notesSelectedLevel={notesSelectedLevel}
      notesSelectedTopic={notesSelectedTopic}
      notesFilterVisible={notesFilterVisible}
      publicStats={publicStats}
      communityActivity={communityActivity}
      weeklyChallengeAnswer={weeklyChallengeAnswer}
      moodSelected={moodSelected}
      setMoodSelected={setMoodSelected}
      moodMessage={moodMessage}
      setMoodMessage={setMoodMessage}
      moodSubmitted={moodSubmitted}
      continueLearning={continueLearning}
      chatRoomId={chatRoomId}
      chatMessages={chatMessages}
      chatOpen={chatOpen}
      chatInput={chatInput}
      adminOnline={adminOnline}
      theme={theme}
      currentSlide={currentSlide}
      mobileMenuOpen={mobileMenuOpen}
      contactForm={contactForm}
      contactStatus={contactStatus}
      newsletterEmail={newsletterEmail}
      newsletterStatus={newsletterStatus}
      pdfPreviewOpen={pdfPreviewOpen}
      previewPdf={previewPdf}
      notesContent={notesContent}
      notesReactions={notesReactions}
      notesComments={notesComments}
      notesCommentInput={notesCommentInput}
      groupedNotes={groupedNotes}
      getLevelColor={getLevelColor}
      user={user}
      logout={logout}
      navigate={navigate}
      currentYear={currentYear}
      handleWeeklyChallengeSubmit={handleWeeklyChallengeSubmit}
      handleContactSubmit={handleContactSubmit}
      handleNewsletterSubmit={handleNewsletterSubmit}
      handleMoodSubmit={handleMoodSubmit}
      shuffleFlashcards={shuffleFlashcards}
      setFlashcardMode={setFlashcardMode}
      setFlashcardCurrentDeck={setFlashcardCurrentDeck}
      setFlashcardCurrentIndex={setFlashcardCurrentIndex}
      toggleCardFlip={toggleCardFlip}
      setFlashcardSelectedLevel={setFlashcardSelectedLevel}
      fetchPdfsByLevel={fetchPdfsByLevel}
      handlePdfPreview={handlePdfPreview}
      handlePdfDownload={handlePdfDownload}
      loadNoteContent={loadNoteContent}
      handleNoteReaction={handleNoteReaction}
      handleNoteComment={handleNoteComment}
      toggleKnown={toggleKnown}
      rateFlashcard={rateFlashcard}
      checkFlashcardAnswer={checkFlashcardAnswer}
      toggleFlashcardBookmark={toggleFlashcardBookmark}
      speakText={speakText}
      requestChatRoom={requestChatRoom}
      sendChat={sendChat}
      deleteChatMsg={deleteChatMsg}
      setChatOpen={setChatOpen}
      setChatInput={setChatInput}
      setMobileMenuOpen={setMobileMenuOpen}
      setTheme={setTheme}
      setContactForm={setContactForm}
      setNewsletterEmail={setNewsletterEmail}
      setPdfPreviewOpen={setPdfPreviewOpen}
      setNotesSelectedLevel={setNotesSelectedLevel}
      setNotesSelectedTopic={setNotesSelectedTopic}
      setNotesFilterVisible={setNotesFilterVisible}
      setNotesContent={setNotesContent}
      setNotesCommentInput={setNotesCommentInput}
      chatBodyRef={chatBodyRef}
    />
  );
}
