import { getCached, setCache, invalidateCache } from '../utils/cache';
import * as api from './client';

function withCache(key, fetcher, cacheEnabled = true) {
  return async (...args) => {
    if (cacheEnabled) {
      const cached = getCached(key);
      if (cached) return cached;
    }
    const data = await fetcher(...args);
    if (cacheEnabled && data) {
      setCache(key, data);
    }
    return data;
  };
}

function withArgsCache(keyFn, fetcher, cacheEnabled = true) {
  return async (...args) => {
    const key = keyFn(...args);
    if (cacheEnabled) {
      const cached = getCached(key);
      if (cached) return cached;
    }
    const data = await fetcher(...args);
    if (cacheEnabled && data) {
      setCache(key, data);
    }
    return data;
  };
}

export const getAllSiteSections = () =>
  withCache('site_sections', api.getAllSiteSections)();

export const getSectionHeadings = () =>
  withCache('section_headings', api.getSectionHeadings)();

export const getResources = (filters = {}) =>
  withArgsCache((f) => `resources_${JSON.stringify(f)}`, api.getResources)(filters);

export const getFilterOptions = () =>
  withCache('filter_options', api.getFilterOptions)();

export const getPdfsByLevel = (level) =>
  withCache(`pdfs_${level}`, () => api.getPdfsByLevel(level))();

export const getNotesStructure = () =>
  withCache('notes_structure', api.getNotesStructure)();

export const getNoteContent = (subtopicId) =>
  withCache(`note_${subtopicId}`, () => api.getNoteContent(subtopicId), false)();

export const getNotePreview = (subtopicId) =>
  withCache(`note_preview_${subtopicId}`, () => api.getNotePreview(subtopicId))();

export const getQuizTopics = ({ level }) =>
  withCache(`quiz_topics_${level}`, () => api.getQuizTopics({ level }))();

export const getPastPapers = (filters = {}) =>
  withArgsCache((f) => `past_papers_${JSON.stringify(f)}`, api.getPastPapers)(filters);

export const getPastPaperFilterOptions = () =>
  withCache('past_paper_filter_options', api.getPastPaperFilterOptions)();

export const getPastPaper = (id) =>
  withCache(`past_paper_${id}`, () => api.getPastPaper(id))();

export const getGlossaryTerms = (level, category, search) =>
  withArgsCache((l, c, s) => `glossary_${l}_${c || ''}_${s || ''}`, api.getGlossaryTerms)(level, category, search);

export const getGlossaryCategories = (level) =>
  withCache(`glossary_categories_${level}`, () => api.getGlossaryCategories(level))();

export const getInfoSection = (section) =>
  withCache(`info_section_${section}`, () => api.getInfoSection(section))();

export const getInfoSectionsList = () =>
  withCache('info_sections_list', api.getInfoSectionsList)();

 export const getFlashcards = (filters = {}) =>
  withArgsCache((f) => `flashcards_list_${JSON.stringify(f)}`, api.getFlashcards)(filters);

export const getFlashcardDecks = (filters = {}) =>
  withArgsCache((f) => `flashcard_decks_${JSON.stringify(f)}`, api.getFlashcardDecks)(filters);

export const getFlashcardDeck = (deckId) =>
  withCache(`flashcard_deck_${deckId}`, () => api.getFlashcardDeck(deckId))();

export const getKnownFlashcards = () =>
  withCache('known_flashcards', api.getKnownFlashcards, false)();

export const getFlashcardProgress = () =>
  withCache('flashcard_progress', api.getFlashcardProgress, false)();

export const getFlashcardOnboardingState = () =>
  api.getFlashcardOnboardingState();

export const getFlashcardActiveSession = (deckId) =>
  api.getFlashcardActiveSession(deckId);

export const getAdaptiveFlashcardDecks = () =>
  api.getAdaptiveFlashcardDecks();

export const getPublicStats = () =>
  withCache('public_stats', api.getPublicStats)();

export const getLeaderboard = (level, limit = 20) =>
  withCache(`leaderboard_${level}_${limit}`, () => api.getLeaderboard(level, limit))();

export const getRecallTopics = (level) =>
  withCache(`recall_topics_${level}`, () => api.getRecallTopics(level))();

export const getRecallStats = () =>
  withCache('recall_stats', api.getRecallStats, false)();

export const getRecallAchievements = () =>
  withCache('recall_achievements', api.getRecallAchievements, false)();

export const getRecallDashboard = () =>
  withCache('recall_dashboard', api.getRecallDashboard, false)();

export const getSelectedLevel = () =>
  withCache('recall_selected_level', api.getSelectedLevel, false)();

export const getCommunityActivity = () =>
  withCache('community_activity', api.getCommunityActivity, false)();

export const getUserStreak = () =>
  withCache('user_streak', api.getUserStreak, false)();

export const getUserAchievements = () =>
  withCache('user_achievements', api.getUserAchievements, false)();

export const getUserFavorites = () =>
  withCache('user_favorites', api.getUserFavorites, false)();

export const getContinueReading = (limit = 10) =>
  withCache(`continue_reading_${limit}`, () => api.getContinueReading(limit), false)();

export const getChatMessages = (roomId) =>
  withCache(`chat_${roomId}`, () => api.getChatMessages(roomId), false)();

export const checkAdminOnline = () =>
  withCache('admin_online', api.checkAdminOnline, false)();

export function invalidateNoteCache(id) { invalidateCache(`note_${id}`); }
export function invalidateChatCache(roomId) { invalidateCache(`chat_${roomId}`); }
export function invalidateRecallCache() {
  invalidateCache('recall_stats');
  invalidateCache('recall_achievements');
  invalidateCache('recall_dashboard');
  invalidateCache('recall_selected_level');
}
export function invalidateUserCache() {
  invalidateCache('user_streak');
  invalidateCache('user_achievements');
  invalidateCache('user_favorites');
}

export {
  signup,
  signin,
  signout,
  getUser,
  updateSiteSection,
  updateSectionHeadings,
  trackPdfPreview,
  trackPdfDownload,
  getNoteReactions,
  toggleNoteReaction,
  saveReadingProgress,
  getReadingProgress,
  submitResource,
  approveResource,
  getResourceSubmissions,
  getQuizBlock,
  checkDailyRetry,
  checkQuizAnswer,
  submitQuizBlock,
  addQuizQuestionsBatch,
  getPlatformStats,
  getUserDashboard,
  getDailyChallenge,
  getWeakAreas,
  getLearningPaths,
  getPersonalRecords,
  getPastPaperDownloadUrl,
  addPastPaper,
  addPastPapersBatch,
  deletePastPaper,
  trackPastPaperDownload,
  toggleFavorite,
  recordView,
  recordDownload,
  recordDailyVisit,
  submitRating,
  likeResource,
  commentResource,
  getResourceInteractions,
  getRecentViews,
  getUserRatings,
  submitMood,
  saveAchievement,
  saveQuizState,
  getQuizState,
  trackEvent,
  getAdminStats,
  getSubmissions,
  getContactMessages,
  getAdminUsers,
  getNewsletterSubscribers,
  getDonations,
  getPageActivity,
  updateUserRole,
  updateUserLock,
  updateUserRestriction,
  updateAppFeature,
  deleteQuizTopic,
  submitContact,
  subscribeNewsletter,
  requestChat,
  sendChatMessage,
  deleteChatMessage,
  updateUserPresence,
  adminGetPendingRequests,
  adminAcceptChat,
  adminRejectChat,
  adminUpdatePresence,
  adminGetActiveChats,
  submitWeeklyChallenge,
  getWeeklyChallengeStatus,
   createFlashcardDeck,
updateFlashcardDeck,
deleteFlashcardDeck,
addFlashcardCards,
removeFlashcardCard,
toggleFlashcardKnown,
rateFlashcard,
checkFlashcardAnswer,
toggleFlashcardBookmark,
saveFlashcardOnboarding,
resetFlashcardOnboarding,
startFlashcardSession,
updateFlashcardSession,
completeFlashcardSession,
  uploadFile,
  getRecallSession,
  checkRecallSession,
  checkFirstVisit,
  continueRecallSession,
  submitRecallAnswer,
  completeRecallSession,
  setSelectedLevel,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  getGlossaryTerm,
  updateInfoSection,
} from './client';
