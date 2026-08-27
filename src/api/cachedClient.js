import {
  getCached,
  setCache,
  invalidateCache,
  invalidateCacheByPattern
} from '../utils/cache';

import * as api from './client';

const inFlight = new Map();

function hasCachedValue(value) {
  return value !== undefined && value !== null;
}

function withCache(
  key,
  fetcher,
  cacheEnabled = true
) {
  return async (...args) => {
    if (cacheEnabled) {
      const cached = getCached(key);

      if (hasCachedValue(cached)) {
        return cached;
      }

      if (inFlight.has(key)) {
        return inFlight.get(key);
      }
    }

    const promise = Promise.resolve()
      .then(() => fetcher(...args))
      .then((data) => {
        if (
          cacheEnabled &&
          data !== undefined &&
          data !== null
        ) {
          setCache(key, data);
        }

        return data;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    if (cacheEnabled) {
      inFlight.set(key, promise);
    }

    return promise;
  };
}

function stableSerialize(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  if (Array.isArray(value)) {
    return `[${value
      .map(stableSerialize)
      .join(',')}]`;
  }

  if (
    typeof value === 'object' &&
    value !== null
  ) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSerialize(
            value[key]
          )}`
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function withArgsCache(
  keyFn,
  fetcher,
  cacheEnabled = true
) {
  return async (...args) => {
    const key = keyFn(...args);

    if (cacheEnabled) {
      const cached = getCached(key);

      if (hasCachedValue(cached)) {
        return cached;
      }

      if (inFlight.has(key)) {
        return inFlight.get(key);
      }
    }

    const promise = Promise.resolve()
      .then(() => fetcher(...args))
      .then((data) => {
        if (
          cacheEnabled &&
          data !== undefined &&
          data !== null
        ) {
          setCache(key, data);
        }

        return data;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    if (cacheEnabled) {
      inFlight.set(key, promise);
    }

    return promise;
  };
}

export const bootstrapPlatform = (level) =>
  withCache(
    `bootstrap_${level}`,
    () => api.bootstrapPlatform(level)
  )();

export const getPlatformConfig = (level) =>
  withCache(
    `platform_config_${level}`,
    () => api.getPlatformConfig(level)
  )();

export const getHeader = (level) =>
  withCache(
    `header_${level}`,
    () => api.getHeader(level)
  )();

export const getFooter = (level) =>
  withCache(
    `footer_${level}`,
    () => api.getFooter(level)
  )();

export const getLandingPage = (level) =>
  withCache(
    `landing_${level}`,
    () => api.getLandingPage(level)
  )();

export const getOnboardingConfig = (level) =>
  withCache(
    `onboarding_${level}`,
    () => api.getOnboardingConfig(level)
  )();

export const getUIComponents = (level) =>
  withCache(
    `ui_components_${level}`,
    () => api.getUIComponents(level)
  )();

export const getPlatformSections = (levelId) =>
  withCache(
    `platform_sections_${levelId}`,
    () => api.getPlatformSections(levelId)
  )();

export const getAllSiteSections = () =>
  withCache(
    'site_sections',
    api.getAllSiteSections
  )();

export const getSectionHeadings = () =>
  withCache(
    'section_headings',
    api.getSectionHeadings
  )();

export const getResources = (filters = {}) =>
  withArgsCache(
    (f) =>
      `resources_${stableSerialize(f)}`,
    api.getResources
  )(filters);

export const getFilterOptions = () =>
  withCache(
    'filter_options',
    api.getFilterOptions
  )();

export const getPdfsByLevel = (unitId) =>
  withCache(
    `pdfs_${unitId || 'all'}`,
    () => api.getPdfsByLevel(unitId)
  )();

export const getNotesStructure = (
  unitId
) =>
  withCache(
    `notes_structure_${unitId || 'all'}`,
    () => api.getNotesList(unitId)
  )();

export const getNoteContent = (
  noteId
) =>
  withCache(
    `note_content_${noteId}`,
    () => api.getNoteContent(noteId),
    false
  )();

export const getNotePreview = (
  noteId
) =>
  withCache(
    `note_preview_${noteId}`,
    () => api.getNotePreview(noteId)
  )();

export const getQuizTopics = (
  unitId
) =>
  withCache(
    `quiz_topics_${unitId}`,
    () => api.getQuizTopics(unitId)
  )();

export const listQuizTopics = (
  groupId
) =>
  withCache(
    `quiz_topics_list_${groupId || 'unknown'}`,
    () => api.listQuizTopics(groupId),
    false
  )();

export const getPastPapers = (
  filters = {}
) =>
  withArgsCache(
    (f) =>
      `past_papers_${stableSerialize(f)}`,
    api.getPastPapers
  )(filters);

export const getPastPaperFilterOptions =
  () =>
    withCache(
      'past_paper_filter_options',
      api.getPastPaperFilterOptions
    )();

export const getPastPaper = (id) =>
  withCache(
    `past_paper_${id}`,
    () => api.getPastPaper(id)
  )();

export const getGlossaryTerms = (
  level,
  category,
  search
) =>
  withArgsCache(
    (l, c, s) =>
      `glossary_${l || ''}_${c || ''}_${s || ''}`,
    api.getGlossaryTerms
  )(level, category, search);

export const getGlossaryCategories = (
  level
) =>
  withCache(
    `glossary_categories_${level || 'all'}`,
    () => api.getGlossaryCategories(level)
  )();

export const getGlossaryTerm = (
  slug,
  level
) =>
  withCache(
    `glossary_term_${slug}_${level || ''}`,
    () => api.getGlossaryTerm(slug, level)
  )();

export const getInfoSection = (
  section
) =>
  withCache(
    `info_section_${section}`,
    () => api.getInfoSection(section)
  )();

export const getInfoSectionsList = () =>
  withCache(
    'info_sections_list',
    api.getInfoSectionsList
  )();

export const getFlashcards = (
  filters = {}
) =>
  withArgsCache(
    (f) =>
      `flashcards_list_${stableSerialize(f)}`,
    api.getFlashcards
  )(filters);

export const getFlashcardDecks = (
  filters = {}
) =>
  withArgsCache(
    (f) =>
      `flashcard_decks_${stableSerialize(f)}`,
    api.getFlashcardDecks
  )(filters);

export const getFlashcardDeck = (
  deckId
) =>
  withCache(
    `flashcard_deck_${deckId}`,
    () => api.getFlashcardDeck(deckId)
  )();

export const getKnownFlashcards = () =>
  withCache(
    'known_flashcards',
    api.getKnownFlashcards,
    false
  )();

export const getFlashcardProgress = () =>
  withCache(
    'flashcard_progress',
    api.getFlashcardProgress,
    false
  )();

export const getFlashcardActiveSession = (
  deckId
) =>
  api.getFlashcardActiveSession(deckId);

export const getAdaptiveFlashcardDecks = () =>
  api.getAdaptiveFlashcardDecks();

export const getPublicStats = () =>
  withCache(
    'public_stats',
    api.getPublicStats
  )();

export const getLeaderboard = (
  level,
  limit = 20
) =>
  withCache(
    `leaderboard_${level}_${limit}`,
    () => api.getLeaderboard(level, limit)
  )();

export const getRecallTopics = (
  groupId
) =>
  withCache(
    `recall_topics_${groupId || 'all'}`,
    () => api.getRecallTopics(groupId),
    false
  )();

export const getRecallDueQueue = (
  limit = 20
) =>
  withCache(
    `recall_due_queue_${limit}`,
    () => api.getRecallDueQueue(limit),
    false
  )();

export const submitRecallConfidence = (
  sessionId,
  questionId,
  confidence
) =>
  api.submitRecallConfidence(
    sessionId,
    questionId,
    confidence
  );

export const getRecallStats = () =>
  withCache(
    'recall_stats',
    api.getRecallStats,
    false
  )();

export const startRecallSession = (
  unitId
) =>
  api.startRecallSession(unitId);

export const getRecallAchievements = () =>
  withCache(
    'recall_achievements',
    api.getRecallAchievements,
    false
  )();

export const getRecallDashboard = () =>
  withCache(
    'recall_dashboard',
    api.getRecallDashboard,
    false
  )();

export const getSelectedLevel = () =>
  withCache(
    'recall_selected_level',
    api.getSelectedLevel,
    false
  )();

export const getCommunityActivity = () =>
  withCache(
    'community_activity',
    api.getCommunityActivity,
    false
  )();

export const getUserStreak = () =>
  withCache(
    'user_streak',
    api.getUserStreak,
    false
  )();

export const getUserAchievements = () =>
  withCache(
    'user_achievements',
    api.getUserAchievements,
    false
  )();

export const getUserFavorites = () =>
  withCache(
    'user_favorites',
    api.getUserFavorites,
    false
  )();

export const getContinueReading = (
  limit = 10
) =>
  withCache(
    `continue_reading_${limit}`,
    () => api.getContinueReading(limit),
    false
  )();

export const getChatMessages = (
  roomId
) =>
  withCache(
    `chat_${roomId}`,
    () => api.getChatMessages(roomId),
    false
  )();

export const checkAdminOnline = () =>
  withCache(
    'admin_online',
    api.checkAdminOnline,
    false
  )();

export const getClassroomTopics = (
  groupId,
  level
) =>
  withArgsCache(
    (g, l) =>
      `classroom_topics_${g || ''}_${l || ''}`,
    api.getClassroomTopics
  )(groupId, level);

export const listClassrooms = (
  unitId,
  groupId
) =>
  withArgsCache(
    (u, g) =>
      `classroom_list_${u || ''}_${g || ''}`,
    api.listClassrooms
  )(unitId, groupId);

export const getLiveClassroomFeed = () =>
  withCache(
    'classroom_live_feed',
    api.getLiveClassroomFeed
  )();

export const getClassroomLevels = () =>
  withCache(
    'classroom_levels',
    api.getClassroomLevels
  )();

export const getClassroomRoom = (
  roomId
) =>
  withCache(
    `classroom_room_${roomId}`,
    () => api.getClassroomRoom(roomId),
    false
  )();

export const getClassroomMessages = (
  roomId
) =>
  withCache(
    `classroom_messages_${roomId}`,
    () => api.getClassroomMessages(roomId),
    false
  )();

export const getClassroomParticipants = (
  roomId
) =>
  withCache(
    `classroom_participants_${roomId}`,
    () => api.getClassroomParticipants(roomId),
    false
  )();

export const getTutorStatus = () =>
  api.getTutorStatus();

export const startQuizSession = (
  unitId,
  blockNumber,
  state = {}
) =>
  api.startQuizSession(
    unitId,
    blockNumber,
    state
  );

export const trackTabSwitch = (
  unitId,
  blockNumber
) =>
  api.trackTabSwitch(
    unitId,
    blockNumber
  );

export const submitQuizWithSession = (
  unitId,
  blockNumber,
  answers,
  timeTaken
) =>
  api.submitQuizWithSession(
    unitId,
    blockNumber,
    answers,
    timeTaken
  );

export const checkQuizAnswer = (
  payload
) =>
  api.checkQuizAnswer(payload);

export const getQuizSessionStatus = () =>
  api.getQuizSessionStatus();

export const getUnits = (
  filters = {}
) =>
  withArgsCache(
    (f) =>
      `units_${stableSerialize(f)}`,
    api.getUnits
  )(filters);

export const switchClass = async (
  groupId
) => {
  const result =
    await api.switchClass(groupId);

  invalidateCacheByPattern(
    'bootstrap_'
  );

  invalidateCacheByPattern(
    'platform_config_'
  );

  invalidateCacheByPattern(
    'header_'
  );

  invalidateCacheByPattern(
    'footer_'
  );

  invalidateCacheByPattern(
    'landing_'
  );

  invalidateCacheByPattern(
    'onboarding_'
  );

  invalidateCacheByPattern(
    'ui_components_'
  );

  invalidateCacheByPattern(
    'platform_sections_'
  );

  invalidateCacheByPattern(
    'units_'
  );

  invalidateCacheByPattern(
    'user_'
  );

  invalidateCacheByPattern(
    'quiz_topics_list_'
  );

  invalidateCacheByPattern(
    'recall_topics_'
  );

  invalidateCacheByPattern(
    'leaderboard_'
  );

  invalidateCacheByPattern(
    'classroom_topics_'
  );

  invalidateCacheByPattern(
    'classroom_list_'
  );

  invalidateCacheByPattern(
    'continue_reading_'
  );

  return result;
};

export function invalidateRecallCache() {
  invalidateCacheByPattern(
    'recall_'
  );
}

export function invalidateUserCache() {
  invalidateCacheByPattern(
    'user_'
  );

  invalidateCache(
    'known_flashcards'
  );

  invalidateCache(
    'flashcard_progress'
  );

  invalidateCache(
    'recall_dashboard'
  );

  invalidateCache(
    'recall_stats'
  );

  invalidateCache(
    'recall_achievements'
  );
}

export function invalidateFlashcardCache() {
  invalidateCacheByPattern(
    'flashcard_'
  );

  invalidateCache(
    'known_flashcards'
  );

  invalidateCache(
    'flashcard_progress'
  );
}

export function invalidateNoteCache(id) {
  invalidateCache(
    `note_content_${id}`
  );

  invalidateCache(
    `note_preview_${id}`
  );

  invalidateCache(
    `note_structure_${id}`
  );

  invalidateCache(
    `continue_reading_10`
  );
}

export function invalidateChatCache(
  roomId
) {
  invalidateCache(
    `chat_${roomId}`
  );
}

export function invalidateClassroomCache(
  roomId
) {
  invalidateCache(
    `classroom_room_${roomId}`
  );

  invalidateCache(
    `classroom_messages_${roomId}`
  );

  invalidateCache(
    `classroom_participants_${roomId}`
  );

  invalidateCache(
    'classroom_live_feed'
  );
}

export const listTutorsCached = (
  filters = {}
) =>
  withArgsCache(
    (f) =>
      `tutors_${stableSerialize(f)}`,
    api.listTutors
  )(filters);

export const getTutorDetailCached = (
  profileId
) =>
  withCache(
    `tutor_detail_${profileId}`,
    () => api.getTutorDetail(profileId)
  )();

export const getMyTutorProfile =
  () =>
    api.getMyTutorProfile();

export const createOrUpdateTutorProfile =
  (payload) =>
    api.createOrUpdateTutorProfile(
      payload
    );

export const updateTutorEmployment =
  (employment) =>
    api.updateTutorEmployment(
      employment
    );

export const uploadVerification = (
  fileId,
  verificationType
) =>
  api.uploadVerification(
    fileId,
    verificationType
  );

export const activateListing = (
  profileId,
  paymentId
) =>
  api.activateListing(
    profileId,
    paymentId
  );

export const sendContactRequest = (
  tutorUserId,
  message
) =>
  api.sendContactRequest(
    tutorUserId,
    message
  );

export const respondContactRequest = (
  requestId,
  action
) =>
  api.respondContactRequest(
    requestId,
    action
  );

export const searchNotes = (
  query,
  limit = 20
) =>
  api.searchNotes(
    query,
    limit
  );

export const getNoteInternalLinks = (
  noteId
) =>
  api.getNoteInternalLinks(
    noteId
  );

export const getMyBookmarks = () =>
  api.getMyBookmarks();

export const getUserDashboard = () =>
  api.getUserDashboard();

export const getDailyChallenge = () =>
  api.getDailyChallenge();

export const getWeakAreas = () =>
  api.getWeakAreas();

export const getLearningPaths = (
  level
) =>
  api.getLearningPaths(level);

export const getPersonalRecords = () =>
  api.getPersonalRecords();

export const getRecentViews = (
  limit = 5
) =>
  api.getRecentViews(limit);

export const getUserRatings = () =>
  api.getUserRatings();

export const getPlatformStats = () =>
  api.getPlatformStats();

export const getCurriculumLevels = () =>
  api.getCurriculumLevels();

export const getGroups = (
  levelId
) =>
  api.getGroups(levelId);

export const getUnitBreadcrumb = (
  unitId
) =>
  api.getUnitBreadcrumb(unitId);

export const getQuizBlock = (
  unitId,
  block
) =>
  api.getQuizBlock(unitId, block);

export const checkDailyRetry = (
  unitId,
  block
) =>
  api.checkDailyRetry(unitId, block);

export const addQuizQuestionsBatch = (
  unitId,
  questions
) =>
  api.addQuizQuestionsBatch(
    unitId,
    questions
  );

export const getRecallSession = (
  unitId
) =>
  api.getRecallSession(unitId);

export const checkRecallSession = (
  unitId
) =>
  api.checkRecallSession(unitId);

export const continueRecallSession = (
  sessionId
) =>
  api.continueRecallSession(sessionId);

export const submitRecallAnswer = (
  sessionId,
  questionId,
  answer
) =>
  api.submitRecallAnswer(
    sessionId,
    questionId,
    answer
  );

export const completeRecallSession = (
  sessionId
) =>
  api.completeRecallSession(
    sessionId
  );

export const getProfile = () =>
  api.getProfile();

export const saveOnboarding = (
  payload
) =>
  api.saveOnboarding(payload);

export const updateClass = (
  className
) =>
  api.updateClass(className);

export const requestLevelChange = (
  track,
  className,
  reason
) =>
  api.requestLevelChange(
    track,
    className,
    reason
  );

export const getClassSequence = (
  track
) =>
  api.getClassSequence(track);

export const getPharmacyPrograms = () =>
  api.getPharmacyPrograms();

export const getLevelChangeStatus = () =>
  api.getLevelChangeStatus();

export const getPendingLevelChanges =
  () =>
    api.getPendingLevelChanges();

export const reviewLevelChange = (
  requestId,
  action
) =>
  api.reviewLevelChange(
    requestId,
    action
  );

export const adminUpdateProfile = (
  userId,
  track,
  className
) =>
  api.adminUpdateProfile(
    userId,
    track,
    className
  );

export const getDevices = () =>
  api.getDevices();

export const revokeSession = (
  sessionId
) =>
  api.revokeSession(sessionId);

export const getNotificationSettings = () =>
  api.getNotificationSettings();

export const saveNotificationSettings = (
  preferences
) =>
  api.saveNotificationSettings(
    preferences
  );

export const getTutorRooms = () =>
  api.getTutorRooms();

export const createClassroom = (
  payload
) =>
  api.createClassroom(payload);

export const joinClassroom = (
  roomId
) =>
  api.joinClassroom(roomId);

export const leaveClassroom = (
  roomId
) =>
  api.leaveClassroom(roomId);

export const sendClassroomMessage = (
  roomId,
  message
) =>
  api.sendClassroomMessage(
    roomId,
    message
  );

export const raiseHand = (
  roomId,
  raise
) =>
  api.raiseHand(
    roomId,
    raise
  );

export const applyAsTutor = (
  level,
  className,
  subjects,
  qualifications,
  experience
) =>
  api.applyAsTutor(
    level,
    className,
    subjects,
    qualifications,
    experience
  );

export const toggleClassroomMute = (
  roomId,
  targetUserId,
  mute
) =>
  api.toggleClassroomMute(
    roomId,
    targetUserId,
    mute
  );

export const endClassroom = (
  roomId
) =>
  api.endClassroom(roomId);

export const shareClassroomResource = (
  roomId,
  fileId
) =>
  api.shareClassroomResource(
    roomId,
    fileId
  );

export const fileClassroomComplaint = (
  roomId,
  complaintType,
  description
) =>
  api.fileClassroomComplaint(
    roomId,
    complaintType,
    description
  );

export const reviewTutorApplication = (
  applicationId,
  action,
  extra = {}
) =>
  api.reviewTutorApplication(
    applicationId,
    action,
    extra
  );

export const adminListRooms = (
  filters = {}
) =>
  api.adminListRooms(filters);

export const adminListApplications = (
  status
) =>
  api.adminListApplications(status);

export const adminListComplaints = (
  status
) =>
  api.adminListComplaints(status);

export const adminResolveComplaint = (
  complaintId,
  status,
  resolution
) =>
  api.adminResolveComplaint(
    complaintId,
    status,
    resolution
  );

export const submitContact = (
  formData
) =>
  api.submitContact(formData);

export const subscribeNewsletter = (
  email
) =>
  api.subscribeNewsletter(email);

export const getNotifications = (
  params = {}
) =>
  api.getNotifications(params);

export const markNotificationRead = (
  id
) =>
  api.markNotificationRead(id);

export const markAllNotificationsRead =
  () =>
    api.markAllNotificationsRead();

export const dismissNotification = (
  id
) =>
  api.dismissNotification(id);

export const getNotificationPreferences =
  () =>
    api.getNotificationPreferences();

export const updateNotificationPreferences =
  (prefs) =>
    api.updateNotificationPreferences(
      prefs
    );

export const getPastPaperDownloadUrl = (
  id
) =>
  api.getPastPaperDownloadUrl(id);

export const addPastPaper = (
  data
) =>
  api.addPastPaper(data);

export const addPastPapersBatch = (
  papers
) =>
  api.addPastPapersBatch(papers);

export const deletePastPaper = (
  id
) =>
  api.deletePastPaper(id);

export const trackPastPaperDownload = (
  id
) =>
  api.trackPastPaperDownload(id);

export const getContentDetail = (
  type,
  id
) =>
  api.getContentDetail(type, id);

export const getInternalLinks = (
  type,
  id
) =>
  api.getInternalLinks(type, id);

export const getRelatedContent = (
  type,
  id
) =>
  api.getRelatedContent(type, id);

export const toggleBookmark = (
  type,
  id
) =>
  api.toggleBookmark(type, id);

export const rateContent = (
  type,
  id,
  rating,
  difficultyRating
) =>
  api.rateContent(
    type,
    id,
    rating,
    difficultyRating
  );

export const recordContentView = (
  type,
  id
) =>
  api.recordContentView(type, id);

export const listCollections = () =>
  api.listCollections();

export const getCollection = (
  slug
) =>
  api.getCollection(slug);

export const getReactions = (
  type,
  id
) =>
  api.getReactions(type, id);

export const getComments = (
  type,
  id
) =>
  api.getComments(type, id);

export const getEngagementSummary = (
  type,
  id
) =>
  api.getEngagementSummary(type, id);

export const toggleReaction = (
  type,
  id,
  reaction
) =>
  api.toggleReaction(
    type,
    id,
    reaction
  );

export const addComment = (
  type,
  id,
  body,
  parentId
) =>
  api.addComment(
    type,
    id,
    body,
    parentId
  );

export const editComment = (
  commentId,
  body
) =>
  api.editComment(
    commentId,
    body
  );

export const deleteComment = (
  commentId
) =>
  api.deleteComment(commentId);

export const getWeeklyChallengeStatus = (
  weekStart
) =>
  api.getWeeklyChallengeStatus(
    weekStart
  );

export const submitWeeklyChallenge = (
  weekStart,
  selectedOption
) =>
  api.submitWeeklyChallenge(
    weekStart,
    selectedOption
  );

export const uploadFile = (
  formData
) =>
  api.uploadFile(formData);

export const deleteUserFile = (
  fileId
) =>
  api.deleteUserFile(fileId);

export const getUserFiles = (
  category
) =>
  api.getUserFiles(category);

export const fetchLabTools = () =>
  api.fetchLabTools();

export const fetchLabDrugs = (
  level
) =>
  api.fetchLabDrugs(level);

export const fetchLabInteraction = (
  drugAId,
  drugBId
) =>
  api.fetchLabInteraction(
    drugAId,
    drugBId
  );

export const fetchLabPathways = (
  level
) =>
  api.fetchLabPathways(level);

export const fetchLabPathway = (
  slug
) =>
  api.fetchLabPathway(slug);

export const fetchLabCases = (
  level,
  difficulty
) =>
  api.fetchLabCases(
    level,
    difficulty
  );

export const fetchLabCase = (
  id
) =>
  api.fetchLabCase(id);

export const submitLabScore = (
  caseId,
  score,
  maxScore
) =>
  api.submitLabScore(
    caseId,
    score,
    maxScore
  );

export const fetchLabFormulas = (
  level,
  drug
) =>
  api.fetchLabFormulas(
    level,
    drug
  );

export const getContentGuideImage = (
  level,
  className
) =>
  api.getContentGuideImage(
    level,
    className
  );

export const getContentGuideImages = () =>
  api.getContentGuideImages();

export const updateContentGuideImage = (
  level,
  className,
  imageUrl,
  fallbackColor,
  altText
) =>
  api.updateContentGuideImage(
    level,
    className,
    imageUrl,
    fallbackColor,
    altText
  );

export const deleteContentGuideImage = (
  level,
  className
) =>
  api.deleteContentGuideImage(
    level,
    className
  );

export const uploadProfilePicture = (
  formData
) =>
  api.uploadProfilePicture(formData);

export const deleteProfilePicture = () =>
  api.deleteProfilePicture();

export const getProfilePicture = (
  userId
) =>
  api.getProfilePicture(userId);

export const getGlossaryTermCached = (
  slug,
  level
) =>
  api.getGlossaryTerm(slug, level);

export const getAdminStats = () =>
  api.getAdminStats();

export const globalSearch = (
  q,
  extraParams = {}
) =>
  api.globalSearch(
    q,
    extraParams
  );

export const getAllRatings = () =>
  api.getAllRatings();

export const trackPdfPreview = (
  pdfId
) =>
  api.trackPdfPreview(pdfId);

export const trackPdfDownload = (
  pdfId
) =>
  api.trackPdfDownload(pdfId);

export const submitResource = (
  payload
) =>
  api.submitResource(payload);

export const getPaperStats = (
  paperId
) =>
  api.getPaperStats(paperId);

export const togglePaperBookmark = (
  paperId
) =>
  api.togglePaperBookmark(paperId);

export const getBookmarkedPapers = (
  page = 1,
  limit = 20
) =>
  api.getBookmarkedPapers(
    page,
    limit
  );

export const trackPaperView = (
  paperId
) =>
  api.trackPaperView(paperId);

export const getDownloadHistory = (
  page = 1,
  limit = 20
) =>
  api.getDownloadHistory(
    page,
    limit
  );

export const getPaperReviews = (
  paperId,
  page = 1,
  limit = 20
) =>
  api.getPaperReviews(
    paperId,
    page,
    limit
  );

export const ratePaper = (
  paperId,
  rating,
  comment = null
) =>
  api.ratePaper(
    paperId,
    rating,
    comment
  );

export const deletePaperReview = (
  paperId
) =>
  api.deletePaperReview(paperId);

export const updateDisplayName = (
  displayName
) =>
  api.updateDisplayName(
    displayName
  );

export const getPaperFilterPresets = () =>
  api.getPaperFilterPresets();

export const savePaperFilterPreset = (
  name,
  filters
) =>
  api.savePaperFilterPreset(
    name,
    filters
  );

export const deletePaperFilterPreset = (
  presetId
) =>
  api.deletePaperFilterPreset(
    presetId
  );

export const getTrendingPapers = (
  limit = 6
) =>
  api.getTrendingPapers(limit);

export const getRecommendedPapers = (
  limit = 6
) =>
  api.getRecommendedPapers(limit);

export const getAuditLog = () =>
  api.getAuditLog();

export const setupMfa = () =>
  api.setupMfa();

export const confirmMfa = (
  code
) =>
  api.confirmMfa(code);

export const disableMfa = (
  userId
) =>
  api.disableMfa(userId);

export const requestChat = () =>
  api.requestChat();

export const sendChatMessage = (
  roomId,
  message
) =>
  api.sendChatMessage(
    roomId,
    message
  );

export const deleteChatMessage = (
  messageId
) =>
  api.deleteChatMessage(messageId);

export const updateUserPresence = () =>
  api.updateUserPresence();

export const adminGetPendingRequests = () =>
  api.adminGetPendingRequests();

export const adminAcceptChat = (
  roomId
) =>
  api.adminAcceptChat(roomId);

export const adminRejectChat = (
  roomId
) =>
  api.adminRejectChat(roomId);

export const adminUpdatePresence = (
  isOnline,
  isBusy
) =>
  api.adminUpdatePresence(
    isOnline,
    isBusy
  );

export const adminGetActiveChats = () =>
  api.adminGetActiveChats();

export const addFlashcardCards = (
  deckId,
  cards
) =>
  api.addFlashcardCards(
    deckId,
    cards
  );

export const approveResource = (
  submissionId,
  action,
  unitId
) =>
  api.approveResource(
    submissionId,
    action,
    unitId
  );

export const changePassword = (
  current_password,
  new_password
) =>
  api.changePassword(
    current_password,
    new_password
  );

export const checkFlashcardAnswer = (
  cardId,
  answer,
  checkType
) =>
  api.checkFlashcardAnswer(
    cardId,
    answer,
    checkType
  );

export const clearQuizState = () =>
  api.clearQuizState();

export const commentResource = (
  resourceId,
  comment
) =>
  api.commentResource(
    resourceId,
    comment
  );

export const completeFlashcardSession = (
  sessionId
) =>
  api.completeFlashcardSession(sessionId);

export const createFlashcardDeck = (
  payload
) =>
  api.createFlashcardDeck(payload);

export const deleteFlashcardDeck = (
  deckId
) =>
  api.deleteFlashcardDeck(deckId);

export const deleteQuizTopic = (
  unitId
) =>
  api.deleteQuizTopic(unitId);

export const exchangeHandoff = (
  token
) =>
  api.exchangeHandoff(token);

export const getAdminUsers = () =>
  api.getAdminUsers();

export const getAppFeatures = (
  pageId = 'all'
) =>
  api.getAppFeatures(pageId);

export const getContactMessages = () =>
  api.getContactMessages();

export const getDonations = () =>
  api.getDonations();

export const getNewsletterSubscribers = () =>
  api.getNewsletterSubscribers();

export const getNoteBySlug = (
  slug
) =>
  api.getNoteBySlug(slug);

export const getNoteDetail = (
  id
) =>
  api.getNoteDetail(id);

export const getNoteDownloadUrl = (
  id
) =>
  api.getNoteDownloadUrl(id);

export const getNoteReactions = (
  noteId
) =>
  api.getNoteReactions(noteId);

export const getNoteToc = (
  noteId
) =>
  api.getNoteToc(noteId);

export const getNotesList = (
  unitId = null
) =>
  api.getNotesList(unitId);

export const getPageActivity = () =>
  api.getPageActivity();

export const getQuizState = () =>
  api.getQuizState();

export const getReadingProgress = (
  noteId
) =>
  api.getReadingProgress(noteId);

export const getRelatedNotes = (
  noteId
) =>
  api.getRelatedNotes(noteId);

export const getResourceInteractions = (
  resourceId
) =>
  api.getResourceInteractions(resourceId);

export const getResourceSubmissions = () =>
  api.getResourceSubmissions();

export const getSubmissions = () =>
  api.getSubmissions();

export const getTutorDetail = (
  profileId
) =>
  api.getTutorDetail(profileId);

export const getUser = () =>
  api.getUser();

export const getUserActivityTrace = () =>
  api.getUserActivityTrace();

export const likeResource = (
  resourceId
) =>
  api.likeResource(resourceId);

export const listAllUsers = () =>
  api.listAllUsers();

export const listTutors = (
  filters = {}
) =>
  api.listTutors(filters);

export const rateFlashcard = (
  flashcardId,
  difficulty
) =>
  api.rateFlashcard(
    flashcardId,
    difficulty
  );

export const recordDailyVisit = () =>
  api.recordDailyVisit();

export const recordDownload = (
  resourceId
) =>
  api.recordDownload(resourceId);

export const recordView = (
  resourceId
) =>
  api.recordView(resourceId);

export const removeFlashcardCard = (
  cardId
) =>
  api.removeFlashcardCard(cardId);

export const requestHandoff = () =>
  api.requestHandoff();

export const saveAchievement = (
  badge
) =>
  api.saveAchievement(badge);

export const saveQuizState = (
  state
) =>
  api.saveQuizState(state);

export const saveReadingProgress = (
  noteId,
  scrollPercentage,
  scrollPosition,
  timeSpent,
  completed
) =>
  api.saveReadingProgress(
    noteId,
    scrollPercentage,
    scrollPosition,
    timeSpent,
    completed
  );

export const setSelectedLevel = (
  level
) =>
  api.setSelectedLevel(level);

export const signin = (
  email,
  password,
  turnstile_token,
  mfa_code
) =>
  api.signin(
    email,
    password,
    turnstile_token,
    mfa_code
  );

export const signout = () =>
  api.signout();

export const signup = (
  email,
  password,
  turnstile_token,
  extra = {}
) =>
  api.signup(
    email,
    password,
    turnstile_token,
    extra
  );

export const startFlashcardSession = (
  deckId,
  mode
) =>
  api.startFlashcardSession(
    deckId,
    mode
  );

export const submitMood = (
  mood,
  message
) =>
  api.submitMood(
    mood,
    message
  );

export const submitRating = (
  resourceId,
  rating
) =>
  api.submitRating(
    resourceId,
    rating
  );

export const toggleFavorite = (
  resourceId
) =>
  api.toggleFavorite(resourceId);

export const toggleFlashcardBookmark = (
  flashcardId
) =>
  api.toggleFlashcardBookmark(flashcardId);

export const toggleFlashcardKnown = (
  flashcardId
) =>
  api.toggleFlashcardKnown(flashcardId);

export const toggleNoteReaction = (
  noteId,
  reactionType
) =>
  api.toggleNoteReaction(
    noteId,
    reactionType
  );

export const trackEvent = (
  eventName,
  eventData = {}
) =>
  api.trackEvent(
    eventName,
    eventData
  );

export const updateAppFeature = (
  featureKey,
  settings,
  isEnabled
) =>
  api.updateAppFeature(
    featureKey,
    settings,
    isEnabled
  );

export const updateFlashcardDeck = (
  deckId,
  updates
) =>
  api.updateFlashcardDeck(
    deckId,
    updates
  );

export const updateFlashcardSession = (
  sessionId,
  cardId,
  correct,
  index
) =>
  api.updateFlashcardSession(
    sessionId,
    cardId,
    correct,
    index
  );

export const updateInfoSection = (
  section,
  data
) =>
  api.updateInfoSection(
    section,
    data
  );

export const updateProfile = (
  full_name
) =>
  api.updateProfile(full_name);

export const updateSectionHeadings = (
  headings
) =>
  api.updateSectionHeadings(headings);

export const updateSiteSection = (
  section,
  data
) =>
  api.updateSiteSection(
    section,
    data
  );

export const updateUserLock = (
  userId,
  lock,
  reason
) =>
  api.updateUserLock(
    userId,
    lock,
    reason
  );

export const updateUserRestriction = (
  userId,
  restrictionType,
  reason,
  durationHours
) =>
  api.updateUserRestriction(
    userId,
    restrictionType,
    reason,
    durationHours
  );

export const updateUserRole = (
  userId,
  role
) =>
  api.updateUserRole(
    userId,
    role
  );
