 import React from 'react';
import { PlatformCards } from './PlatformCards';
import { StatsGrid } from './StatsGrid';
import { TestimonialSlider } from './TestimonialSlider';
import { ContinueLearningSection } from './ContinueLearningSection';
import { FlashcardSection } from '../flashcards/FlashcardSection';
import { PdfLibrarySection } from '../pdfs/PdfLibrarySection';
import { PdfPreviewModal } from '../pdfs/PdfPreviewModal';
import { NotesSection } from '../Notes/NotesSection';
import { MoodCheckSection } from '../mood/MoodCheckSection';
import { CommunitySection } from '../community/CommunitySection';
import { ContactSection } from '../contact/ContactSection';
import { ChatWidget } from '../chat/ChatWidget';
import { NewsletterForm } from './NewsletterForm';

export default function HomeView(props) {
  const {
    sections,
    flashcards,
    flashcardDecks,
    flashcardShuffled,
    knownFlashcardIds,
    flashcardMode,
    flashcardCurrentDeck,
    flashcardCurrentIndex,
    flippedCards,
    flashcardSelectedLevel,
    flashcardDeckProgress,
    pdfs,
    pdfLevel,
    pdfSelectedTopic,
    notesStructure,
    notesSelectedLevel,
    notesSelectedTopic,
    notesFilterVisible,
    publicStats,
    communityActivity,
    weeklyChallengeAnswer,
    moodSelected,
    setMoodSelected,
    moodMessage,
    setMoodMessage,
    moodSubmitted,
    continueLearning,
    streak,
    chatOpen,
    chatMessages,
    chatInput,
    adminOnline,
    currentSlide,
    contactForm,
    contactStatus,
    newsletterEmail,
    newsletterStatus,
    pdfPreviewOpen,
    previewPdf,
    notesContent,
    notesReactions,
    notesComments,
    notesCommentInput,
    groupedNotes,
    getLevelColor,
    user,
    navigate,
    currentYear,
    handleWeeklyChallengeSubmit,
    handleContactSubmit,
    handleNewsletterSubmit,
    handleMoodSubmit,
    shuffleFlashcards,
    setFlashcardMode,
    setFlashcardCurrentDeck,
    setFlashcardCurrentIndex,
    toggleCardFlip,
    setFlashcardSelectedLevel,
    fetchPdfsByLevel,
    handlePdfPreview,
    handlePdfDownload,
    loadNoteContent,
    handleNoteReaction,
    handleNoteComment,
    toggleKnown,
    rateFlashcard,
    checkFlashcardAnswer,
    toggleFlashcardBookmark,
    speakText,
    requestChatRoom,
    sendChat,
    deleteChatMsg,
    setChatOpen,
    setChatInput,
    setContactForm,
    setNewsletterEmail,
    setPdfPreviewOpen,
    setPdfLevel,
    setPdfSelectedTopic,
    setNotesSelectedLevel,
    setNotesSelectedTopic,
    setNotesFilterVisible,
    setNotesContent,
    setNotesCommentInput,
    chatBodyRef,
  } = props;

  return (
    <div className="home-page">
      <PlatformCards />

      <StatsGrid
        stats={{
          resources_count: publicStats?.resources_count || 0,
          users_count: publicStats?.users_count || 0,
          downloads_count: publicStats?.downloads_count || 0,
          quiz_attempts: publicStats?.quiz_attempts || 0,
        }}
      />

      <ContinueLearningSection
        continueLearning={continueLearning}
        user={user}
        streak={streak}
      />

      <FlashcardSection
        headingTitle={sections?.section_headings?.flashcards_title || 'Study Flashcards'}
        headingSubtitle={sections?.section_headings?.flashcards_subtitle || 'Reinforce your knowledge'}
        onStartStudy={() => (user ? navigate('/flashcards') : navigate('/login'))}
        onBrowseDecks={() => navigate('/flashcards')}
        user={user}
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
        shuffleFlashcards={shuffleFlashcards}
        setFlashcardMode={setFlashcardMode}
        setFlashcardCurrentDeck={setFlashcardCurrentDeck}
        setFlashcardCurrentIndex={setFlashcardCurrentIndex}
        toggleCardFlip={toggleCardFlip}
        setFlashcardSelectedLevel={setFlashcardSelectedLevel}
        toggleKnown={toggleKnown}
        rateFlashcard={rateFlashcard}
        checkFlashcardAnswer={checkFlashcardAnswer}
        toggleFlashcardBookmark={toggleFlashcardBookmark}
        speakText={speakText}
      />

      <PdfLibrarySection
        pdfs={pdfs}
        pdfLevel={pdfLevel}
        pdfSelectedTopic={pdfSelectedTopic}
        onPreview={handlePdfPreview}
        onDownload={handlePdfDownload}
        fetchPdfsByLevel={fetchPdfsByLevel}
        setPdfLevel={setPdfLevel}
        setPdfSelectedTopic={setPdfSelectedTopic}
      />

      <NotesSection
        groupedNotes={groupedNotes}
        notesStructure={notesStructure}
        notesSelectedLevel={notesSelectedLevel}
        notesSelectedTopic={notesSelectedTopic}
        notesFilterVisible={notesFilterVisible}
        notesContent={notesContent}
        notesReactions={notesReactions}
        notesComments={notesComments}
        notesCommentInput={notesCommentInput}
        onReadNote={(id) => {
          if (id) navigate(`/notes/read?id=${id}`);
          else setNotesContent(null);
        }}
        onReaction={handleNoteReaction}
        onComment={handleNoteComment}
        onCommentInputChange={setNotesCommentInput}
        setNotesSelectedLevel={setNotesSelectedLevel}
        setNotesSelectedTopic={setNotesSelectedTopic}
        setNotesFilterVisible={setNotesFilterVisible}
        getLevelColor={getLevelColor}
        user={user}
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

      <TestimonialSlider quotes={sections?.testimonials?.quotes || []} />

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
