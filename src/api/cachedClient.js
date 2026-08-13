 /* api/cachedClient.js */
import {
  getCached,
  setCache,
  invalidateCache,
  invalidateCacheByPattern
} from '../utils/cache';
import * as api from './client';

const inFlight = new Map();

function withCache(key, fetcher, cacheEnabled = true) {
  return async (...args) => {
    if (cacheEnabled) {
      const cached = getCached(key);

      if (cached) return cached;

      if (inFlight.has(key)) return inFlight.get(key);
    }

    const promise = fetcher(...args)
      .then((data) => {
        if (cacheEnabled && data) setCache(key, data);
        return data;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    if (cacheEnabled) inFlight.set(key, promise);

    return promise;
  };
}

function withArgsCache(keyFn, fetcher, cacheEnabled = true) {
  return async (...args) => {
    const key = keyFn(...args);

    if (cacheEnabled) {
      const cached = getCached(key);

      if (cached) return cached;

      if (inFlight.has(key)) return inFlight.get(key);
    }

    const promise = fetcher(...args)
      .then((data) => {
        if (cacheEnabled && data) setCache(key, data);
        return data;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    if (cacheEnabled) inFlight.set(key, promise);

    return promise;
  };
}

export const bootstrapPlatform = (level) =>
  withCache(`bootstrap_${level}`, () => api.bootstrapPlatform(level))();

export const getAllSiteSections = () =>
  withCache('site_sections', api.getAllSiteSections)();

export const getSectionHeadings = () =>
  withCache('section_headings', api.getSectionHeadings)();

export const getResources = (filters = {}) =>
  withArgsCache((f) => `resources_${JSON.stringify(f)}`, api.getResources)(filters);

export const getFilterOptions = () =>
  withCache('filter_options', api.getFilterOptions)();

export const getPdfsByLevel = (unitId) =>
  withCache(`pdfs_${unitId || 'all'}`, () => api.getPdfsByLevel(unitId))();

export const getNotesStructure = (unitId) =>
  withCache(`notes_structure_${unitId || 'all'}`, () => api.getNotesList(unitId))();

export const getNoteContent = (noteId) =>
  withCache(`note_content_${noteId}`, () => api.getNoteContent(noteId), false)();

export const getNotePreview = (noteId) =>
  withCache(`note_preview_${noteId}`, () => api.getNotePreview(noteId))();

export const getQuizTopics = (unitId) =>
  withCache(`quiz_topics_${unitId}`, () => api.getQuizTopics(unitId))();

export const listQuizTopics = (groupId) =>
  withCache(`quiz_topics_list_${groupId || 'unknown'}`, api.listQuizTopics, false)();

export const getPastPapers = (filters = {}) =>
  withArgsCache((f) => `past_papers_${JSON.stringify(f)}`, api.getPastPapers)(filters);

export const getPastPaperFilterOptions = () =>
  withCache('past_paper_filter_options', api.getPastPaperFilterOptions)();

export const getPastPaper = (id) =>
  withCache(`past_paper_${id}`, () => api.getPastPaper(id))();

export const getGlossaryTerms = (level, category, search) =>
  withArgsCache(
    (l, c, s) => `glossary_${l}_${c || ''}_${s || ''}`,
    api.getGlossaryTerms
  )(level, category, search);

export const getGlossaryCategories = (level) =>
  withCache(`glossary_categories_${level || 'all'}`, () => api.getGlossaryCategories(level))();

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

export const getFlashcardActiveSession = (deckId) =>
  api.getFlashcardActiveSession(deckId);

export const getAdaptiveFlashcardDecks = () =>
  api.getAdaptiveFlashcardDecks();

export const getPublicStats = () =>
  withCache('public_stats', api.getPublicStats)();

export const getLeaderboard = (level, limit = 20) =>
  withCache(`leaderboard_${level}_${limit}`, () => api.getLeaderboard(level, limit))();

export const getRecallTopics = (groupId) =>
  withCache(`recall_topics_${groupId || 'all'}`, () => api.getRecallTopics(groupId), false)();

export const getRecallStats = () =>
  withCache('recall_stats', api.getRecallStats, false)();

export const startRecallSession = (unitId) =>
  api.getRecallSession(unitId);

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

export const getClassroomTopics = (groupId, level) =>
  withArgsCache(
    (g, l) => `classroom_topics_${g}_${l || ''}`,
    api.getClassroomTopics
  )(groupId, level);

export const listClassrooms = (unitId, groupId) =>
  withArgsCache(
    (u, g) => `classroom_list_${u}_${g || ''}`,
    api.listClassrooms
  )(unitId, groupId);

export const getLiveClassroomFeed = () =>
  withCache('classroom_live_feed', api.getLiveClassroomFeed)();

export const getClassroomLevels = () =>
  withCache('classroom_levels', api.getClassroomLevels)();

export const getClassroomRoom = (roomId) =>
  withCache(`classroom_room_${roomId}`, () => api.getClassroomRoom(roomId), false)();

export const getClassroomMessages = (roomId) =>
  withCache(`classroom_messages_${roomId}`, () => api.getClassroomMessages(roomId), false)();

export const getClassroomParticipants = (roomId) =>
  withCache(`classroom_participants_${roomId}`, () => api.getClassroomParticipants(roomId), false)();

export const getTutorStatus = () =>
  api.getTutorStatus();

export const startQuizSession = (unitId, blockNumber, state = {}) =>
  api.startQuizSession(unitId, blockNumber, state);

export const trackTabSwitch = (unitId, blockNumber) =>
  api.trackTabSwitch(unitId, blockNumber);

export const submitQuizWithSession = (unitId, blockNumber, answers, timeTaken) =>
  api.submitQuizWithSession(unitId, blockNumber, answers, timeTaken);

export const checkQuizAnswer = (payload) =>
  api.checkQuizAnswer(payload);

export const getQuizSessionStatus = () =>
  api.getQuizSessionStatus();

export const getUnits = (filters = {}) =>
  withArgsCache((f) => `units_${JSON.stringify(f)}`, api.getUnits)(filters);

export const switchClass = async (groupId) => {
  const result = await api.switchClass(groupId);

  invalidateCacheByPattern('bootstrap_');
  invalidateCacheByPattern('units_');
  invalidateCacheByPattern('user_');
  invalidateCacheByPattern('quiz_topics_list_');
  invalidateCacheByPattern('recall_topics_');
  invalidateCacheByPattern('leaderboard_');
  invalidateCacheByPattern('classroom_topics_');
  invalidateCacheByPattern('classroom_list_');

  return result;
};

export function invalidateRecallCache() {
  invalidateCacheByPattern('recall_');
}

export function invalidateUserCache() {
  invalidateCacheByPattern('user_');
}

export function invalidateFlashcardCache() {
  invalidateCacheByPattern('flashcard');
}

export function invalidateNoteCache(id) {
  invalidateCache(`note_content_${id}`);
  invalidateCache(`note_preview_${id}`);
}

export function invalidateChatCache(roomId) {
  invalidateCache(`chat_${roomId}`);
}

export function invalidateClassroomCache(roomId) {
  invalidateCache(`classroom_room_${roomId}`);
  invalidateCache(`classroom_messages_${roomId}`);
  invalidateCache(`classroom_participants_${roomId}`);
}

export const listTutorsCached = (filters = {}) =>
  withArgsCache((f) => `tutors_${JSON.stringify(f)}`, api.listTutors)(filters);

export const getTutorDetailCached = (profileId) =>
  withCache(`tutor_detail_${profileId}`, () => api.getTutorDetail(profileId))();

export {
  signup,
  signin,
  signout,
  getUser,
  updateProfile,
  changePassword,
  requestHandoff,
  exchangeHandoff,
  getPlatformConfig,
  getHeader,
  getFooter,
  getLandingPage,
  getOnboardingConfig,
  getUIComponents,
  getPlatformSections,
  updateSiteSection,
  updateSectionHeadings,
  updateInfoSection,
  getNotesList,
  getNoteDetail,
  getNoteBySlug,
  getRelatedNotes,
  getNoteToc,
  getReadingProgress,
  saveReadingProgress,
  getNoteDownloadUrl,
  getContentDetail,
  getInternalLinks,
  getRelatedContent,
  toggleBookmark,
  rateContent,
  recordContentView,
  listCollections,
  getCollection,
  getReactions,
  getComments,
  getEngagementSummary,
  toggleReaction,
  addComment,
  editComment,
  deleteComment,
  getMyBookmarks,
  getNoteReactions,
  toggleNoteReaction,
  toggleFavorite,
  recordView,
  recordDownload,
  recordDailyVisit,
  submitRating,
  likeResource,
  commentResource,
  getResourceInteractions,
  submitMood,
  saveAchievement,
  saveQuizState,
  getQuizState,
  clearQuizState,
  trackEvent,
  getPlatformStats,
  getUserDashboard,
  getDailyChallenge,
  getWeakAreas,
  getLearningPaths,
  getPersonalRecords,
  getRecentViews,
  getUserRatings,
  setSelectedLevel,
  createFlashcardDeck,
  updateFlashcardDeck,
  deleteFlashcardDeck,
  addFlashcardCards,
  removeFlashcardCard,
  toggleFlashcardKnown,
  rateFlashcard,
  checkFlashcardAnswer,
  toggleFlashcardBookmark,
  startFlashcardSession,
  updateFlashcardSession,
  completeFlashcardSession,
  getCurriculumLevels,
  getGroups,
  getUnitBreadcrumb,
  getQuizBlock,
  checkDailyRetry,
  addQuizQuestionsBatch,
  getRecallSession,
  checkRecallSession,
  continueRecallSession,
  submitRecallAnswer,
  completeRecallSession,
  getProfile,
  saveOnboarding,
  updateClass,
  requestLevelChange,
  getClassSequence,
  getPharmacyPrograms,
  getLevelChangeStatus,
  getPendingLevelChanges,
  reviewLevelChange,
  adminUpdateProfile,
  getTutorRooms,
  createClassroom,
  joinClassroom,
  leaveClassroom,
  sendClassroomMessage,
  raiseHand,
  applyAsTutor,
  toggleClassroomMute,
  endClassroom,
  shareClassroomResource,
  fileClassroomComplaint,
  reviewTutorApplication,
  adminListRooms,
  adminListApplications,
  adminListComplaints,
  adminResolveComplaint,
  submitContact,
  subscribeNewsletter,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  getPastPaperDownloadUrl,
  addPastPaper,
  addPastPapersBatch,
  deletePastPaper,
  trackPastPaperDownload,
  getResourceSubmissions,
  getSubmissions,
  approveResource,
  getContactMessages,
  getAdminUsers,
  listAllUsers,
  getNewsletterSubscribers,
  getDonations,
  getPageActivity,
  getAppFeatures,
  getUserActivityTrace,
  updateUserRole,
  updateUserLock,
  updateUserRestriction,
  updateAppFeature,
  deleteQuizTopic,
  requestChat,
  sendChatMessage,
  deleteChatMessage,
  updateUserPresence,
  adminGetPendingRequests,
  adminAcceptChat,
  adminRejectChat,
  adminUpdatePresence,
  adminGetActiveChats,
  getWeeklyChallengeStatus,
  submitWeeklyChallenge,
  uploadFile,
  deleteUserFile,
  getUserFiles,
  fetchLabTools,
  fetchLabDrugs,
  fetchLabInteraction,
  fetchLabPathways,
  fetchLabPathway,
  fetchLabCases,
  fetchLabCase,
  submitLabScore,
  fetchLabFormulas,
  getContentGuideImage,
  getContentGuideImages,
  updateContentGuideImage,
  deleteContentGuideImage,
  uploadProfilePicture,
  deleteProfilePicture,
  getProfilePicture,
  getGlossaryTerm,
  getAdminStats,
  globalSearch,
  getAllRatings,
  trackPdfPreview,
  trackPdfDownload,
  submitResource
} from './client';
