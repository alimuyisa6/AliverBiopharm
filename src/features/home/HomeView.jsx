 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useLevelFilter } from '../../hooks/useLevelFilter';
import { useContentAccess } from '../../hooks/useContentAccess';

import { HeroCards } from './HeroCards';
import { StatsGrid } from './StatsGrid';
import { TeamScroll } from './TeamScroll';
import { TestimonialSlider } from './TestimonialSlider';
import { PricingCards } from './PricingCards';
import { BlogGrid } from './BlogGrid';
import { FaqAccordion } from './FaqAccordion';
import { NewsletterForm } from './NewsletterForm';
import { ContinueLearningSection } from './ContinueLearningSection';
import { ContentGuideCard } from './ContentGuideCard';

import { FlashcardSection } from '../flashcards/FlashcardSection';
import { PdfLibrarySection } from '../pdfs/PdfLibrarySection';
import { PdfPreviewModal } from '../pdfs/PdfPreviewModal';
import { NotesSection } from '../Notes/NotesSection';
import { MoodCheckSection } from '../mood/MoodCheckSection';
import { CommunitySection } from '../community/CommunitySection';
import { ContactSection } from '../contact/ContactSection';
import { ChatWidget } from '../chat/ChatWidget';
import { ClassroomSection } from '../classroom/ClassroomSection';

import InfoCards from '../../components/InfoCards';
import InteractiveShowcase from '../../components/InteractiveShowcase';
import { PendingApprovalScreen } from '../../components/access/PendingApprovalScreen';
import {
  getResources,
  getPastPapers,
  getQuizTopics,
  getFlashcardDecks,
  getPublicStats,
  getContinueReading,
  getCommunityActivity,
  getPdfsByLevel,
  getNotesStructure,
} from '../../api/client';
import { getSections } from '../../api/sections';

let homeDataCache = null;

export default function HomeView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const access = useContentAccess();
  const { level, class_name, showAll } = useLevelFilter();

  const [loading, setLoading] = useState(!homeDataCache);
  const [sections, setSections] = useState(homeDataCache?.sections || {});
  const [publicStats, setPublicStats] = useState(homeDataCache?.publicStats || null);
  const [communityActivity, setCommunityActivity] = useState(homeDataCache?.communityActivity || []);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [weeklyChallengeAnswer, setWeeklyChallengeAnswer] = useState(null);
  const [moodSelected, setMoodSelected] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [continueLearning, setContinueLearning] = useState([]);
  const [pdfs, setPdfs] = useState(homeDataCache?.pdfs || []);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [groupedNotes, setGroupedNotes] = useState(homeDataCache?.groupedNotes || {});
  const [notesContent, setNotesContent] = useState(null);
  const [notesReactions, setNotesReactions] = useState(null);
  const [notesComments, setNotesComments] = useState([]);
  const [notesCommentInput, setNotesCommentInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const chatBodyRef = React.useRef(null);

  useEffect(() => {
    if (access.isPending) return;
    loadInitialData();
  }, [access.isPending, level]);

  const loadInitialData = async () => {
    if (!homeDataCache) setLoading(true);
    try {
      const effectiveLevel = showAll ? null : level;
      const effectiveClass = showAll ? null : class_name;

      const [
        stats,
        papers,
        topics,
        decks,
        continueReading,
        activity,
        pdfData,
        notesData,
        sectionsData
      ] = await Promise.all([
        getPublicStats().catch(() => null),
        getPastPapers({ limit: 3 }).catch(() => []),
        getQuizTopics({
          level: effectiveLevel || 'O-Level',
          class_name: effectiveClass
        }).catch(() => []),
        getFlashcardDecks({
          level: effectiveLevel || 'O-Level',
          class_programme: effectiveClass
        }).catch(() => []),
        user ? getContinueReading(5).catch(() => []) : Promise.resolve([]),
        getCommunityActivity().catch(() => []),
        effectiveLevel
          ? getPdfsByLevel(effectiveLevel, effectiveClass).catch(() => ({ pdfs: [] }))
          : Promise.resolve({ pdfs: [] }),
        effectiveLevel
          ? getNotesStructure(effectiveLevel, effectiveClass).catch(() => [])
          : Promise.resolve([]),
        getSections().catch(() => ({}))
      ]);

      setPublicStats(stats);
      setCommunityActivity(activity);
      setContinueLearning(continueReading);
      setPdfs(pdfData?.pdfs || []);

      const notesGrouped = {};
      (notesData || []).forEach(item => {
        const topic = item.topic || 'General';
        if (!notesGrouped[topic]) notesGrouped[topic] = [];
        notesGrouped[topic].push(item);
      });
      setGroupedNotes(notesGrouped);

      setSections(sectionsData || {});

      homeDataCache = {
        sections: sectionsData || {},
        publicStats: stats,
        communityActivity: activity,
        pdfs: pdfData?.pdfs || [],
        groupedNotes: notesGrouped
      };

    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactStatus({
      success: true,
      message: 'Thank you! We\'ll get back to you soon.'
    });
    setContactForm({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setContactStatus(null), 3000);
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    setNewsletterStatus({
      success: true,
      message: 'Subscribed successfully!'
    });
    setNewsletterEmail('');
    setTimeout(() => setNewsletterStatus(null), 3000);
  };

  const handleWeeklyChallengeSubmit = (selected) => {
    setWeeklyChallengeAnswer({
      selected,
      correct: true,
      explanation: 'Correct! This is the right answer.'
    });
  };

  const handleMoodSubmit = () => {
    if (moodSelected) {
      setMoodSubmitted(true);
      setTimeout(() => {
        setMoodSelected(null);
        setMoodMessage('');
        setMoodSubmitted(false);
      }, 3000);
    }
  };

  const handlePdfPreview = (pdf) => {
    setPreviewPdf(pdf);
    setPdfPreviewOpen(true);
  };

  const handlePdfDownload = (pdf) => {
    window.open(pdf.file_url, '_blank');
  };

  const handleNoteReaction = (noteId, reaction) => {
    setNotesReactions(prev => ({
      ...prev,
      counts: {
        ...prev?.counts,
        [reaction]: (prev?.counts?.[reaction] || 0) + 1
      },
      user_reaction: reaction
    }));
  };

  const handleNoteComment = (noteId) => {
    if (notesCommentInput.trim()) {
      setNotesComments(prev => [
        ...prev,
        {
          comment: notesCommentInput,
          user_name: 'You',
          created_at: new Date().toISOString()
        }
      ]);
      setNotesCommentInput('');
    }
  };

  const sendChat = () => {
    if (chatInput.trim()) {
      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          sender_type: 'user',
          content: chatInput,
          created_at: new Date().toISOString()
        }
      ]);
      setChatInput('');
      setTimeout(() => {
        setChatMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender_type: 'admin',
            content: 'Thanks for your message. How can I help?',
            created_at: new Date().toISOString()
          }
        ]);
      }, 1500);
    }
  };

  const deleteChatMsg = (id) => {
    setChatMessages(prev => prev.filter(msg => msg.id !== id));
  };

  if (access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (loading) {
    return (
      <div className="home-loading">
        <div className="home-loading-spinner">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <HeroCards
        cards={sections?.hero_cards}
        user={user}
      />

      <InteractiveShowcase />

      <InfoCards />

      <ClassroomSection user={user} />

      <StatsGrid
        stats={{
          resources_count: publicStats?.resources_count || 0,
          users_count: publicStats?.users_count || 0,
          downloads_count: publicStats?.downloads_count || 0,
          quiz_attempts: publicStats?.quiz_attempts || 0
        }}
      />

      <ContentGuideCard user={user} />

      <ContinueLearningSection
        continueLearning={continueLearning}
        user={user}
      />

      <FlashcardSection
        headingTitle={sections?.section_headings?.flashcards_title}
        headingSubtitle={sections?.section_headings?.flashcards_subtitle}
        onStartStudy={() => user ? navigate('/flashcards') : navigate('/login')}
        onBrowseDecks={() => navigate('/flashcards')}
        user={user}
      />

      <PdfLibrarySection
        pdfs={pdfs}
        onPreview={handlePdfPreview}
        onDownload={handlePdfDownload}
      />

      <NotesSection
        groupedNotes={groupedNotes}
        notesContent={notesContent}
        notesReactions={notesReactions}
        notesComments={notesComments}
        notesCommentInput={notesCommentInput}
        onReadNote={(id) => {
          if (id) {
            navigate(`/notes/read?id=${id}`);
          } else {
            setNotesContent(null);
          }
        }}
        onReaction={handleNoteReaction}
        onComment={handleNoteComment}
        onCommentInputChange={setNotesCommentInput}
      />

      <CommunitySection
        activity={communityActivity}
        weeklyChallenge={sections.weekly_challenge}
        weeklyChallengeAnswer={weeklyChallengeAnswer}
        onWeeklySubmit={handleWeeklyChallengeSubmit}
      />

      <MoodCheckSection
        moodSelected={moodSelected}
        moodMessage={moodMessage}
        moodSubmitted={moodSubmitted}
        onMoodSelect={setMoodSelected}
        onMessageChange={setMoodMessage}
        onSubmit={handleMoodSubmit}
      />

      <TeamScroll members={sections?.team?.members || []} />

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />

      <PricingCards plans={sections?.pricing?.plans || []} />

      <BlogGrid posts={sections?.blog?.posts || []} />

      <FaqAccordion items={sections?.faq?.items || []} />

      <ContactSection
        contactForm={contactForm}
        contactStatus={contactStatus}
        contactInfo={sections?.contact?.info || []}
        onChange={setContactForm}
        onSubmit={handleContactSubmit}
      />

      <NewsletterForm
        email={newsletterEmail}
        status={newsletterStatus}
        onChange={(e) => setNewsletterEmail(e.target.value)}
        onSubmit={handleNewsletterSubmit}
      />

      <ChatWidget
        chatOpen={chatOpen}
        chatMessages={chatMessages}
        chatInput={chatInput}
        adminOnline={adminOnline}
        onToggle={() => setChatOpen(!chatOpen)}
        onSend={sendChat}
        onInputChange={setChatInput}
        onDeleteMsg={deleteChatMsg}
        chatBodyRef={chatBodyRef}
      />

      {pdfPreviewOpen && (
        <PdfPreviewModal
          pdf={previewPdf}
          onClose={() => setPdfPreviewOpen(false)}
          onDownload={handlePdfDownload}
        />
      )}
    </div>
  );
}
