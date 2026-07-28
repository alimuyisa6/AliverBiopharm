 import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeView from '../features/home/HomeView';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import {
  getPublicStats,
  getCommunityActivity,
  getContinueReading,
  getUserStreak,
  submitMood,
  submitContact,
  subscribeNewsletter,
  requestChat,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  checkAdminOnline,
  getNotesStructure,
  getNoteReactions,
  toggleNoteReaction,
  getResourceInteractions,
  commentResource,
  getFlashcards,
  getFlashcardDecks,
  getKnownFlashcards,
  getFlashcardProgress,
  getPdfsByLevel,
  rateFlashcard,
  checkFlashcardAnswer,
  toggleFlashcardBookmark,
} from '../api/cachedClient';
import { getSections } from '../api/sections';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const { user } = useAuth();
  const { groups } = useLayout();
  const navigate = useNavigate();

  // All state variables initialised to safe defaults
  const [sections, setSections] = useState({});
  const [publicStats, setPublicStats] = useState(null);
  const [communityActivity, setCommunityActivity] = useState([]);
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
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [notesStructure, setNotesStructure] = useState(null);
  const [notesSelectedLevel, setNotesSelectedLevel] = useState(null);
  const [notesSelectedTopic, setNotesSelectedTopic] = useState(null);
  const [notesFilterVisible, setNotesFilterVisible] = useState(false);
  const [notesContent, setNotesContent] = useState(null);
  const [notesReactions, setNotesReactions] = useState(null);
  const [notesComments, setNotesComments] = useState([]);
  const [notesCommentInput, setNotesCommentInput] = useState('');
  const [groupedNotes, setGroupedNotes] = useState({});
  const [moodSelected, setMoodSelected] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [weeklyChallengeAnswer, setWeeklyChallengeAnswer] = useState(null);
  const [continueLearning, setContinueLearning] = useState([]);
  const [streak, setStreak] = useState(0);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const chatBodyRef = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    getSections().then(setSections).catch(() => {});
    getPublicStats().then(setPublicStats).catch(() => {});
    getCommunityActivity().then(setCommunityActivity).catch(() => {});
    checkAdminOnline().then(res => setAdminOnline(res?.online)).catch(() => {});

    if (user) {
      getContinueReading().then(data => {
        setContinueLearning(Array.isArray(data) ? data : []);
      }).catch(() => {});
      getUserStreak().then(res => {
        setStreak(res?.count || 0);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!groups || !Array.isArray(groups) || groups.length === 0) return;
    const primaryGroup = groups[0];
    loadGroupContent(primaryGroup.id);
  }, [groups]);

  useEffect(() => {
    if (!sections?.hero?.slides?.length) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % sections.hero.slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [sections]);

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

  const loadGroupContent = useCallback(async (groupId) => {
    try {
      const { getUnits } = await import('../api/client');
      const units = await getUnits({ group_id: groupId });
      if (!units || !Array.isArray(units) || units.length === 0) return;
      const unitId = units[0].id;

      Promise.all([
        getFlashcards({ unit_id: unitId }),
        getFlashcardDecks({ unit_id: unitId }),
        getKnownFlashcards(),
        getFlashcardProgress(),
        getPdfsByLevel(unitId),
        getNotesStructure(unitId),
      ]).then(([flashRes, deckRes, knownRes, progRes, pdfRes, notesRes]) => {
        setFlashcards(Array.isArray(flashRes) ? flashRes : []);
        setFlashcardDecks(Array.isArray(deckRes) ? deckRes : []);
        setKnownFlashcardIds(Array.isArray(knownRes) ? knownRes : []);
        setFlashcardDeckProgress(progRes || {});
        setPdfs(Array.isArray(pdfRes?.pdfs) ? pdfRes.pdfs : []);
        setNotesStructure(Array.isArray(notesRes) ? notesRes : []);

        const grouped = {};
        (Array.isArray(notesRes) ? notesRes : []).forEach(item => {
          const key = item.title || item.slug || 'Untitled';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(item);
        });
        setGroupedNotes(grouped);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load group content:', err);
    }
  }, []);

  function getLevelColor(level) {
    if (level === 'O-Level') return '#0ab5b5';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#10b981';
    return 'var(--clr-cyan)';
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

  function toggleKnown(cardId) {
    setKnownFlashcardIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  }

  async function rateFlashcardHandler(cardId, difficulty) {
    try { await rateFlashcard(cardId, difficulty); } catch (e) {}
  }

  async function checkFlashcardAnswerHandler(cardId, userAnswer) {
    try {
      return await checkFlashcardAnswer(cardId, userAnswer);
    } catch (e) { return { correct: false, correct_answer: 'Error' }; }
  }

  async function toggleFlashcardBookmarkHandler(cardId) {
    try { await toggleFlashcardBookmark(cardId); } catch (e) {}
  }

  function speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }

  async function fetchPdfsByLevel(level) {
    try {
      const res = await getPdfsByLevel(level);
      setPdfs(Array.isArray(res?.pdfs) ? res.pdfs : []);
    } catch (e) {}
  }

  function handlePdfPreview(pdf) {
    setPreviewPdf(pdf);
    setPdfPreviewOpen(true);
  }

  function handlePdfDownload(pdf) {
    window.open(pdf.file_url, '_blank');
  }

  async function loadNoteContent(noteId) {
    try {
      const { getNoteContent } = await import('../api/client');
      const content = await getNoteContent(noteId);
      const reactions = await getNoteReactions(noteId);
      const interactions = await getResourceInteractions(noteId);
      setNotesContent(content);
      setNotesReactions(reactions);
      setNotesComments(Array.isArray(interactions?.comments) ? interactions.comments : []);
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
      setNotesComments(Array.isArray(interactions?.comments) ? interactions.comments : []);
    } catch (e) { console.error(e); }
  }

  async function handleMoodSubmit() {
    if (!moodSelected) return;
    try {
      await submitMood(moodSelected, moodMessage);
      setMoodSubmitted(true);
    } catch (e) {}
  }

  async function handleWeeklyChallengeSubmit(i, correct, explanation) {
    if (!user) return;
    setWeeklyChallengeAnswer({ correct: i === correct, explanation });
    try {
      await submitWeeklyChallenge(new Date().toISOString().slice(0, 10), i);
    } catch (e) {}
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    try {
      await submitContact(contactForm);
      setContactStatus({ success: true, message: 'Message sent!' });
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
      setNewsletterStatus({ success: true, message: 'Subscribed!' });
      setNewsletterEmail('');
    } catch (e) {
      setNewsletterStatus({ success: false, message: e.message });
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
        setChatMessages(Array.isArray(messages) ? messages : []);
      }
    } catch (e) { console.error(e); }
  }

  async function sendChat() {
    if (!chatInput.trim() || !chatRoomId) return;
    try {
      await sendChatMessage(chatRoomId, chatInput);
      setChatInput('');
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch (e) { console.error(e); }
  }

  async function deleteChatMsg(msgId) {
    try {
      await deleteChatMessage(msgId);
      const messages = await getChatMessages(chatRoomId);
      setChatMessages(Array.isArray(messages) ? messages : []);
    } catch (e) { console.error(e); }
  }

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
      streak={streak}
      chatRoomId={chatRoomId}
      chatMessages={chatMessages}
      chatOpen={chatOpen}
      chatInput={chatInput}
      adminOnline={adminOnline}
      currentSlide={currentSlide}
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
      rateFlashcard={rateFlashcardHandler}
      checkFlashcardAnswer={checkFlashcardAnswerHandler}
      toggleFlashcardBookmark={toggleFlashcardBookmarkHandler}
      speakText={speakText}
      requestChatRoom={requestChatRoom}
      sendChat={sendChat}
      deleteChatMsg={deleteChatMsg}
      setChatOpen={setChatOpen}
      setChatInput={setChatInput}
      setContactForm={setContactForm}
      setNewsletterEmail={setNewsletterEmail}
      setPdfPreviewOpen={setPdfPreviewOpen}
      setPdfLevel={setPdfLevel}
      setPdfSelectedTopic={setPdfSelectedTopic}
      setNotesSelectedLevel={setNotesSelectedLevel}
      setNotesSelectedTopic={setNotesSelectedTopic}
      setNotesFilterVisible={setNotesFilterVisible}
      setNotesContent={setNotesContent}
      setNotesCommentInput={setNotesCommentInput}
      chatBodyRef={chatBodyRef}
    />
  );
}
