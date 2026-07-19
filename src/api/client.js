 let csrfToken = null;
const API_BASE = '/api/server';

const pendingRequests = new Map();
const requestQueue = [];
let processingQueue = false;
const MAX_CONCURRENT = 3;
let activeRequests = 0;

function handleRestrictionResponse(errorData) {
  pendingRequests.clear();
  requestQueue.length = 0;
  
  localStorage.setItem('login_message', errorData.error || 'Account restricted');
  localStorage.removeItem('user');
  sessionStorage.clear();
  
  csrfToken = null;
  
  window.location.replace('/login');
  
  throw new Error('Account restricted - redirecting to login');
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;

  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const { key, execute, resolve, reject } = requestQueue.shift();
    activeRequests++;

    execute()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        activeRequests--;
        pendingRequests.delete(key);
        processQueue();
      });
  }

  processingQueue = false;
}

function dedupeAndQueue(key, execute) {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const promise = new Promise((resolve, reject) => {
    requestQueue.push({ key, execute, resolve, reject });
    processQueue();
  });

  pendingRequests.set(key, promise);
  return promise;
}

async function apiCall(module, path, body = {}, method = 'POST') {
  const url = `${API_BASE}?module=${module}&path=${path}`;
  const cacheKey = `${method}:${module}:${path}`;

  return dedupeAndQueue(cacheKey, async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: method === 'POST' ? JSON.stringify(body) : undefined
    });

    const json = await res.json();
    if (json.csrf_token) csrfToken = json.csrf_token;
    
    if (!res.ok) {
      if (res.status === 403 && json.restricted) {
        handleRestrictionResponse(json);
      }
      
      console.error(`API Error ${res.status}: ${module}/${path}`, json.error);
      const err = new Error(json.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    
    return json.data !== undefined ? json.data : json;
  });
}

async function getRequest(module, path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}?module=${module}&path=${path}${query ? `&${query}` : ''}`;
  const cacheKey = `GET:${module}:${path}:${query}`;

  return dedupeAndQueue(cacheKey, async () => {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json();
    if (json.csrf_token) csrfToken = json.csrf_token;
    
    if (!res.ok) {
      if (res.status === 403 && json.restricted) {
        handleRestrictionResponse(json);
      }
      
      console.error(`API Error ${res.status}: ${module}/${path}`, json.error);
      const err = new Error(json.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    
    return json.data !== undefined ? json.data : json;
  });
}

export { getRequest, apiCall };

export async function signin(email, password, turnstile_token, mfa_code) { return apiCall('auth', 'signin', { email, password, turnstile_token, mfa_code }); }
export async function signout() { return apiCall('auth', 'signout', {}); }
export async function getUser() { return getRequest('auth', 'get_user'); }

export async function getAllSiteSections() { return getRequest('site', 'get_all_site_sections'); }
export async function getSectionHeadings() { return getRequest('site', 'get_section_headings'); }
export async function updateSiteSection(section, data) { return apiCall('site', 'update_site_section', { section, data }); }
export async function updateSectionHeadings(headings) { return apiCall('site', 'update_section_headings', { headings }); }

export async function getResources(filters = {}) { return getRequest('resources', 'get_resources', filters); }
export async function getFilterOptions() { return getRequest('resources', 'get_filter_options'); }
export async function getPdfsByLevel(level) { return getRequest('resources', 'get_pdfs_by_level', { level }); }
export async function trackPdfPreview(pdfId) { return apiCall('resources', 'track_pdf_preview', { pdf_id: pdfId }); }
export async function trackPdfDownload(pdfId) { return apiCall('resources', 'track_pdf_download', { pdf_id: pdfId }); }
export async function getNotesStructure() { return getRequest('resources', 'get_notes_structure'); }
export async function getNoteContent(subtopicId) { return getRequest('resources', 'get_note_content', { subtopic_id: subtopicId }); }
export async function getNotePreview(subtopicId) { return getRequest('resources', 'get_note_preview', { subtopic_id: subtopicId }); }
export async function getNoteReactions(noteId) { return getRequest('resources', 'get_note_reactions', { note_id: noteId }); }
export async function toggleNoteReaction(noteId, reactionType) { return apiCall('resources', 'toggle_note_reaction', { note_id: noteId, reaction_type: reactionType }); }
export async function saveReadingProgress(noteId, scrollPercentage, scrollPosition, timeSpent, completed = false) { return apiCall('resources', 'save_reading_progress', { note_id: noteId, scroll_percentage: scrollPercentage, scroll_position: scrollPosition, time_spent: timeSpent, completed }); }
export async function getReadingProgress(noteId) { return getRequest('resources', 'get_reading_progress', { note_id: noteId }); }
export async function getContinueReading(limit = 10) { return getRequest('resources', 'get_continue_reading', { limit }); }
export async function submitResource(payload) { return apiCall('resources', 'submit_resource', { payload }); }
export async function approveResource(submissionId, action) { return apiCall('resources', 'approve', { submissionId, action }); }
export async function getResourceSubmissions() { return getRequest('resources', 'submissions'); }
export async function getAllRatings() { return getRequest('resources', 'get_all_ratings'); }

export async function getQuizTopics({ level }) { return getRequest('quiz', 'get_quiz_topics', { level }); }
export async function getQuizBlock({ level, topic, block_number }) { return getRequest('quiz', 'get_quiz_block', { level, topic, block_number }); }
export async function checkDailyRetry({ level, topic, block_number }) { return getRequest('quiz', 'check_daily_retry', { level, topic, block_number }); }
export async function checkQuizAnswer({ question_id, selected_option }) { return apiCall('quiz', 'check_quiz_answer', { question_id, selected_option }); }
export async function submitQuizBlock({ level, topic, block_number, answers, time_taken }) { return apiCall('quiz', 'submit_quiz_block', { level, topic, block_number, answers, time_taken }); }
export async function addQuizQuestionsBatch(level, topic, questions, batch_name) { return apiCall('quiz', 'add_quiz_questions_batch', { level, topic, questions, batch_name }); }

export async function getPlatformStats() { return getRequest('interactions', 'platform-stats'); }
export async function getUserDashboard() { return getRequest('interactions', 'dashboard'); }
export async function getDailyChallenge() { return getRequest('interactions', 'daily-challenge'); }
export async function getWeakAreas() { return getRequest('interactions', 'weak-areas'); }
export async function getLearningPaths(level) { return getRequest('interactions', 'learning-paths', { level }); }
export async function getPersonalRecords() { return getRequest('interactions', 'personal-records'); }

export async function getPastPapers(filters = {}) { return getRequest('past-papers', 'get_papers', filters); }
export async function getPastPaperFilterOptions() { return getRequest('past-papers', 'get_filter_options'); }
export async function getPastPaper(id) { return getRequest('past-papers', 'get_paper', { id }); }
export async function getPastPaperDownloadUrl(id) { return getRequest('past-papers', 'get_download_url', { id }); }
export async function addPastPaper(data) { return apiCall('past-papers', 'add_paper', data); }
export async function addPastPapersBatch(papers) { return apiCall('past-papers', 'add_papers_batch', { papers }); }
export async function deletePastPaper(id) { return apiCall('past-papers', 'delete_paper', { id }); }
export async function trackPastPaperDownload(id) { return apiCall('past-papers', 'track_download', { id }); }

export async function toggleFavorite(resourceId) { return apiCall('interactions', 'toggle_favorite', { resource_id: resourceId }); }
export async function recordView(resourceId) { return apiCall('interactions', 'record_view', { resource_id: resourceId }); }
export async function recordDownload(resourceId) { return apiCall('interactions', 'record_download', { resource_id: resourceId }); }
export async function recordDailyVisit() { return apiCall('interactions', 'record_daily_visit', {}); }
export async function submitRating(resourceId, rating) { return apiCall('interactions', 'submit_rating', { resource_id: resourceId, rating }); }
export async function likeResource(resourceId) { return apiCall('interactions', 'like_resource', { resource_id: resourceId }); }
export async function commentResource(resourceId, comment) { return apiCall('interactions', 'comment_resource', { resource_id: resourceId, comment }); }
export async function getResourceInteractions(resourceId) { return getRequest('interactions', 'get_resource_interactions', { resource_id: resourceId }); }
export async function getUserFavorites() { return getRequest('interactions', 'get_user_favorites'); }
export async function getRecentViews(limit = 5) { return getRequest('interactions', 'get_recent_views', { limit }); }
export async function getUserRatings() { return getRequest('interactions', 'get_user_ratings'); }
export async function getUserAchievements() { return getRequest('interactions', 'get_user_achievements'); }
export async function getUserStreak() { return getRequest('interactions', 'get_user_streak'); }
export async function getPublicStats() { return getRequest('interactions', 'get_public_stats'); }
export async function submitMood(mood, message) { return apiCall('interactions', 'submit_mood', { mood, message }); }
export async function saveAchievement(badge) { return apiCall('interactions', 'save_achievement', { badge }); }
export async function saveQuizState(state) { return apiCall('interactions', 'save_quiz_state', { state }); }
export async function getQuizState() { return getRequest('interactions', 'get_quiz_state'); }
export async function clearQuizState() { return apiCall('interactions', 'clear_quiz_state', {}); }
export async function trackEvent(eventName, eventData = {}) { return apiCall('interactions', 'track_event', { event_name: eventName, event_data: eventData }); }

export async function getAdminStats() { return getRequest('admin', 'stats'); }
export async function getSubmissions() { return getRequest('admin', 'submissions'); }
export async function getContactMessages() { return getRequest('admin', 'messages'); }
export async function getAdminUsers() { return getRequest('admin', 'get_admin_users'); }
export async function getNewsletterSubscribers() { return getRequest('admin', 'get_newsletter_subscribers'); }
export async function getDonations() { return getRequest('admin', 'get_donations'); }
export async function getPageActivity() { return getRequest('admin', 'get_page_activity'); }
export async function updateUserRole(userId, role) { return apiCall('admin', 'update_user_role', { userId, role }); }
export async function updateUserLock(userId, lock, reason) { return apiCall('admin', 'update_user_lock', { userId, lock, reason }); }
export async function updateUserRestriction(userId, restriction_type, reason, duration_hours) { return apiCall('admin', 'update_user_restriction', { userId, restriction_type, reason, duration_hours }); }
export async function updateAppFeature(feature_key, settings, is_enabled) { return apiCall('admin', 'update_app_feature', { feature_key, settings, is_enabled }); }
export async function getAppFeatures(pageId = 'all') { return getRequest('admin', 'get_app_features', { page_id: pageId }); }
export async function getUserActivityTrace() { return getRequest('admin', 'get_user_activity_trace'); }
export async function deleteQuizTopic(topic, level) { return apiCall('admin', 'delete_quiz_topic', { topic, level }); }
export async function listAllUsers() { return getRequest('admin', 'list_users'); }
export async function getAuditLog() { return getRequest('admin', 'get_audit_log'); }
export async function setupMfa() { return apiCall('admin', 'setup_mfa', {}); }
export async function confirmMfa(code) { return apiCall('admin', 'confirm_mfa', { code }); }
export async function disableMfa(userId) { return apiCall('admin', 'disable_mfa', { userId }); }

export async function submitContact(formData) { return apiCall('contact', 'submit_contact', { formData }); }
export async function subscribeNewsletter(email) { return apiCall('contact', 'subscribe_newsletter', { formData: { email } }); }

export async function requestChat() { return apiCall('chat', 'request_chat', {}); }
export async function getChatMessages(roomId) { return getRequest('chat', 'get_chat_messages', { room_id: roomId }); }
export async function sendChatMessage(roomId, message) { return apiCall('chat', 'send_chat_message', { room_id: roomId, message }); }
export async function deleteChatMessage(messageId) { return apiCall('chat', 'delete_chat_message', { message_id: messageId }); }
export async function checkAdminOnline() { return getRequest('chat', 'check_admin_online'); }
export async function updateUserPresence() { return apiCall('chat', 'update_user_presence', {}); }
export async function adminGetPendingRequests() { return getRequest('chat', 'admin_get_pending_requests'); }
export async function adminAcceptChat(roomId) { return apiCall('chat', 'admin_accept_chat', { room_id: roomId }); }
export async function adminRejectChat(roomId) { return apiCall('chat', 'admin_reject_chat', { room_id: roomId }); }
export async function adminUpdatePresence(is_online, is_busy) { return apiCall('chat', 'admin_update_presence', { is_online, is_busy }); }
export async function adminGetActiveChats() { return getRequest('chat', 'admin_get_active_chats'); }

export async function submitWeeklyChallenge(weekStart, selectedOption) { return apiCall('weekly-challenge', 'submit', { week_start: weekStart, selected_option: selectedOption }); }
export async function getWeeklyChallengeStatus(weekStart) { return getRequest('weekly-challenge', 'status', { week_start: weekStart }); }

export async function getFlashcards(filters = {}) {
  const params = {};
  if (filters.level)           params.level           = filters.level;
  if (filters.discipline)      params.discipline      = filters.discipline;
  if (filters.class_programme) params.class_programme = filters.class_programme;
  if (filters.confidence)      params.confidence      = filters.confidence;
  return getRequest('flashcards', 'list', params);
}

export async function getFlashcardDecks(filters = {}) {
  const params = {};
  if (filters.level)           params.level           = filters.level;
  if (filters.discipline)      params.discipline      = filters.discipline;
  if (filters.class_programme) params.class_programme = filters.class_programme;
  if (filters.confidence)      params.confidence      = filters.confidence;
  return getRequest('flashcards', 'decks', params);
}

export async function getFlashcardDeck(deckId) {
  return getRequest('flashcards', 'deck', { deck_id: deckId });
}

export async function getFlashcardOnboardingState() {
  return getRequest('flashcards', 'onboarding_state');
}

export async function getFlashcardActiveSession(deckId) {
  const params = {};
  if (deckId) params.deck_id = deckId;
  return getRequest('flashcards', 'active_session', params);
}

export async function getAdaptiveFlashcardDecks() {
  return getRequest('flashcards', 'adaptive_decks');
}

export async function saveFlashcardOnboarding(payload) {
  return apiCall('flashcards', 'save_onboarding', payload);
}

export async function resetFlashcardOnboarding() {
  return apiCall('flashcards', 'reset_onboarding', {});
}

export async function startFlashcardSession(deckId, mode = 'flip') {
  return apiCall('flashcards', 'start_session', { deck_id: deckId, mode });
}

export async function updateFlashcardSession(sessionId, cardId, correct, currentIndex) {
  return apiCall('flashcards', 'update_session', {
    session_id:    sessionId,
    card_id:       cardId,
    correct,
    current_index: currentIndex
  });
}

export async function completeFlashcardSession(sessionId) {
  return apiCall('flashcards', 'complete_session', { session_id: sessionId });
}

export async function createFlashcardDeck(title, description, category, level, discipline, class_programme, difficulty_confidence, card_types, cards) {
  return apiCall('flashcards', 'create_deck', {
    title, description, category, level,
    discipline, class_programme, difficulty_confidence, card_types, cards
  });
}

export async function updateFlashcardDeck(deckId, updates) {
  return apiCall('flashcards', 'update_deck', { deck_id: deckId, ...updates });
}

export async function deleteFlashcardDeck(deckId) {
  return apiCall('flashcards', 'delete_deck', { deck_id: deckId });
}

export async function addFlashcardCards(deckId, cards) {
  return apiCall('flashcards', 'add_cards', { deck_id: deckId, cards });
}

export async function removeFlashcardCard(cardId) {
  return apiCall('flashcards', 'remove_card', { card_id: cardId });
}

export async function getKnownFlashcards() {
  return getRequest('flashcards', 'known');
}

export async function toggleFlashcardKnown(flashcardId) {
  return apiCall('flashcards', 'toggle_known', { flashcard_id: flashcardId });
}

export async function rateFlashcard(flashcardId, difficulty) {
  return apiCall('flashcards', 'rate', { flashcard_id: flashcardId, difficulty });
}

export async function checkFlashcardAnswer(flashcardId, userAnswer, checkType = 'answer') {
  return apiCall('flashcards', 'check_answer', {
    flashcard_id: flashcardId,
    user_answer:  userAnswer,
    check_type:   checkType
  });
}

export async function toggleFlashcardBookmark(flashcardId) {
  return apiCall('flashcards', 'toggle_bookmark', { flashcard_id: flashcardId });
}

export async function getFlashcardProgress() {
  return getRequest('flashcards', 'progress');
}

export async function getCommunityActivity() { return getRequest('community', 'activity'); }

export async function getLeaderboard(level, limit = 20) { return getRequest('interactions', 'leaderboard', { level, limit }); }

export async function uploadFile(fileName, fileData) { return apiCall('upload', 'upload_file', { file_name: fileName, file_data: fileData }); }

export async function getRecallSession({ level, topic }) { return getRequest('recall', 'session', { level, topic }); }
export async function checkRecallSession({ level, topic }) { return getRequest('recall', 'session_check', { level, topic }); }
export async function getRecallStats() { return getRequest('recall', 'stats'); }
export async function getRecallAchievements() { return getRequest('recall', 'achievements'); }
export async function getRecallDashboard() { return getRequest('recall', 'dashboard'); }
export async function getRecallTopics(level) { return getRequest('recall', 'topics', { level }); }
export async function checkFirstVisit({ level, topic }) { return getRequest('recall', 'first_visit', { level, topic }); }
export async function getSelectedLevel() { return getRequest('recall', 'get_selected_level'); }
export async function continueRecallSession({ session_id }) { return apiCall('recall', 'continue', { session_id }); }
export async function submitRecallAnswer({ session_id, question_id, user_answer, nonce, started_at }) { return apiCall('recall', 'answer', { session_id, question_id, user_answer, nonce, started_at }); }
export async function completeRecallSession({ session_id }) { return apiCall('recall', 'complete', { session_id }); }
export async function setSelectedLevel(level) { return apiCall('recall', 'set_selected_level', { level }); }

export async function getNotifications(params = {}) { return getRequest('recall', 'notifications', params); }
export async function markNotificationRead(notificationId) { return apiCall('recall', 'notification_read', { notification_id: notificationId }); }
export async function markAllNotificationsRead() { return apiCall('recall', 'notification_read_all', {}); }
export async function dismissNotification(notificationId) { return apiCall('recall', 'notification_dismiss', { notification_id: notificationId }); }
export async function getNotificationPreferences() { return getRequest('recall', 'notification_prefs'); }
export async function updateNotificationPreferences(preferences) { return apiCall('recall', 'notification_prefs_update', { preferences }); }

export async function getGlossaryTerms(level, category, search) {
  const params = { level };
  if (category) params.category = category;
  if (search) params.search = search;
  return getRequest('glossary', 'list', params);
}

export async function getGlossaryTerm(slug, level) {
  return getRequest('glossary', 'term', { slug, level });
}

export async function getGlossaryCategories(level) {
  return getRequest('glossary', 'categories', { level });
}

export async function getInfoSection(section) {
  return getRequest('site', 'get_info_section', { section });
}

export async function getInfoSectionsList() {
  return getRequest('site', 'get_info_sections_list');
}

export async function updateInfoSection(section, data) {
  return apiCall('site', 'update_info_section', { section, ...data });
}

export async function fetchLabTools() { return getRequest('lab', 'tools'); }
export async function fetchLabDrugs(level) {
  const params = {};
  if (level) params.level = level;
  return getRequest('lab', 'drugs', params);
}
export async function fetchLabInteraction(drugAId, drugBId) { return getRequest('lab', 'interactions', { drug_a_id: drugAId, drug_b_id: drugBId }); }
export async function fetchLabPathways(level) {
  const params = {};
  if (level) params.level = level;
  return getRequest('lab', 'pathways', params);
}
export async function fetchLabPathway(slug) { return getRequest('lab', 'pathway_by_slug', { slug }); }
export async function fetchLabCases(level, difficulty) {
  const params = {};
  if (level) params.level = level;
  if (difficulty) params.difficulty = difficulty;
  return getRequest('lab', 'cases', params);
}
export async function fetchLabCase(id) { return getRequest('lab', 'case_by_id', { id }); }
export async function submitLabScore(caseId, userId, score, maxScore) { return apiCall('lab', 'submit_score', { case_id: caseId, user_id: userId, score, max_score: maxScore }); }
export async function fetchLabFormulas(level, drug) {
  const params = {};
  if (level) params.level = level;
  if (drug) params.drug = drug;
  return getRequest('lab', 'formulas', params);
}
export async function startQuizSession(level, topic, blockNumber, state = {}) {
  return apiCall('quiz', 'quiz_start_session', { level, topic, block_number: blockNumber, state });
}

export async function trackTabSwitch(level, topic, blockNumber) {
  return apiCall('quiz', 'quiz_tab_switch', { level, topic, block_number: blockNumber });
}

export async function submitQuizWithSession(level, topic, blockNumber, answers, timeTaken) {
  return apiCall('quiz', 'quiz_submit_with_session', { level, topic, block_number: blockNumber, answers, time_taken: timeTaken });
}

export async function getQuizSessionStatus() {
  return getRequest('quiz', 'quiz_session_status');
}

export async function getClassroomTopics(level, class_name) {
  return getRequest('classroom', 'topics', { level, class_name });
}

export async function listClassrooms(level, class_name, topic_id) {
  return getRequest('classroom', 'list', { level, class_name, topic_id });
}

export async function getClassroomRoom(room_id) {
  return getRequest('classroom', 'room', { room_id });
}

export async function getClassroomMessages(room_id) {
  return getRequest('classroom', 'messages', { room_id });
}

export async function getClassroomParticipants(room_id) {
  return getRequest('classroom', 'participants', { room_id });
}

export async function getLiveClassroomFeed() {
  return getRequest('classroom', 'live_feed');
}

export async function getClassroomLevels() {
  return getRequest('classroom', 'levels');
}

export async function getTutorStatus() {
  return getRequest('classroom', 'tutor_status');
}

export async function getTutorRooms() {
  return getRequest('classroom', 'tutor_rooms');
}

export async function getClassroomOnboardingStatus() {
  return getRequest('classroom', 'onboarding_status');
}

export async function saveClassroomOnboarding(payload) {
  return apiCall('classroom', 'save_onboarding', payload);
}

export async function joinClassroom(room_id) {
  return apiCall('classroom', 'join', { room_id });
}

export async function leaveClassroom(room_id) {
  return apiCall('classroom', 'leave', { room_id });
}

export async function sendClassroomMessage(room_id, message) {
  return apiCall('classroom', 'send_message', { room_id, message });
}

export async function raiseHand(room_id, raise) {
  return apiCall('classroom', 'raise_hand', { room_id, raise });
}

export async function createClassroom(payload) {
  return apiCall('classroom', 'create', payload);
}

export async function applyAsTutor(level, class_name, subjects, qualifications, experience) {
  return apiCall('classroom', 'tutor_apply', { level, class_name, subjects, qualifications, experience });
}

export async function toggleClassroomMute(room_id, target_user_id, mute) {
  return apiCall('classroom', 'toggle_mute', { room_id, target_user_id, mute });
}

export async function endClassroom(room_id) {
  return apiCall('classroom', 'end_room', { room_id });
}

export async function shareClassroomResource(room_id, file_url, file_name, file_size) {
  return apiCall('classroom', 'share_resource', { room_id, file_url, file_name, file_size });
}

export async function fileClassroomComplaint(room_id, complaint_type, description) {
  return apiCall('classroom', 'file_complaint', { room_id, complaint_type, description });
}

export async function reviewTutorApplication(application_id, action, extra = {}) {
  return apiCall('classroom', 'tutor_review', { application_id, action, ...extra });
}

export async function adminListRooms(filters = {}) {
  return getRequest('classroom', 'admin_list_rooms', filters);
}

export async function adminListApplications(status) {
  return getRequest('classroom', 'admin_list_applications', status ? { status } : {});
}

export async function adminListComplaints(status) {
  return getRequest('classroom', 'admin_list_complaints', status ? { status } : {});
}

export async function adminResolveComplaint(complaint_id, status, resolution) {
  return apiCall('classroom', 'admin_resolve_complaint', { complaint_id, status, resolution });
}

export async function adminEndClassroom(room_id) {
  return apiCall('classroom', 'end_room', { room_id });
}

export async function requestHandoff() { return apiCall('auth', 'handoff_create', {}); }
export async function exchangeHandoff(token) { return apiCall('auth', 'handoff_exchange', { token }); }

export async function signup(email, password, turnstile_token, extra = {}) {
  return apiCall('auth', 'signup', { email, password, turnstile_token, ...extra });
}

export async function updateProfile(full_name) {
  return apiCall('auth', 'update_profile', { full_name });
}

export async function changePassword(current_password, new_password) {
  return apiCall('auth', 'change_password', { current_password, new_password });
}

export async function globalSearch(query) {
  return getRequest('search', 'global', { q: query });
}



export async function getProfile() { return getRequest('profile', 'get_profile'); }
export async function saveOnboarding(payload) { return apiCall('profile', 'save_onboarding', payload); }
export async function requestLevelChange(requested_track, requested_class, reason) { return apiCall('profile', 'request_level_change', { requested_track, requested_class, reason }); }
export async function getClassSequence(track) { return getRequest('profile', 'class_sequence', { track }); }
export async function getPharmacyPrograms() { return getRequest('profile', 'pharmacy_programs'); }
export async function getLevelChangeStatus() { return getRequest('profile', 'level_change_status'); }

export async function adminUpdateProfile(user_id, track, class_name) { return apiCall('profile', 'admin_update_profile', { user_id, track, class_name }); }
