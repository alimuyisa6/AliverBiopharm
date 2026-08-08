 let csrfToken = null;
const API_BASE = '/api/server';

const pendingRequests = new Map();
const requestQueue = [];
let processingQueue = false;
const MAX_CONCURRENT = 3;
let activeRequests = 0;

let cacheVersionPromise = null;
let cacheVersionFetchedAt = 0;
const CACHE_VERSION_TTL_MS = 10000;

function handleRestrictionResponse(errorData) {
  pendingRequests.clear();
  requestQueue.length = 0;
  localStorage.setItem('login_message', errorData.error || 'Account restricted');
  localStorage.removeItem('user');
  sessionStorage.clear();
  csrfToken = null;
  window.location.replace('/login');
  throw new Error('Account restricted');
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
  if (pendingRequests.has(key)) return pendingRequests.get(key);
  const promise = new Promise((resolve, reject) => {
    requestQueue.push({ key, execute, resolve, reject });
    processQueue();
  });
  pendingRequests.set(key, promise);
  return promise;
}

async function apiCall(module, path, body = {}, method = 'POST', isFormData = false) {
  const url = `${API_BASE}?module=${module}&path=${path}`;
  const cacheKey = `${method}:${module}:${path}:${isFormData ? 'formdata' : 'json'}`;
  return dedupeAndQueue(cacheKey, async () => {
    const headers = {};
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    let fetchBody;
    if (isFormData) {
      fetchBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = method === 'POST' ? JSON.stringify(body) : undefined;
    }
    const res = await fetch(url, { method, headers, credentials: 'include', body: fetchBody });
    const json = await res.json();
    if (json.csrf_token) csrfToken = json.csrf_token;
    if (!res.ok) {
      if (res.status === 403 && json.restricted) handleRestrictionResponse(json);
      const err = new Error(json.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return json.data !== undefined ? json.data : json;
  });
}

async function deleteRequest(module, path, params = {}) {
  return apiCall(module, path, params, 'DELETE');
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
      if (res.status === 403 && json.restricted) handleRestrictionResponse(json);
      const err = new Error(json.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return json.data !== undefined ? json.data : json;
  });
}

async function getCacheVersion() {
  const now = Date.now();
  if (!cacheVersionPromise || now - cacheVersionFetchedAt > CACHE_VERSION_TTL_MS) {
    cacheVersionFetchedAt = now;
    cacheVersionPromise = getRequest('platform', 'cache_version')
      .then((d) => d?.version || 1)
      .catch(() => 1);
  }
  return cacheVersionPromise;
}

async function getVersionedRequest(module, path, params = {}) {
  const v = await getCacheVersion();
  return getRequest(module, path, { ...params, v });
}

export { getRequest, apiCall, deleteRequest };

export async function signin(email, password, turnstile_token, mfa_code) { return apiCall('auth', 'signin', { email, password, turnstile_token, mfa_code }); }
export async function signout() { return apiCall('auth', 'signout', {}); }
export async function signup(email, password, turnstile_token, extra = {}) { return apiCall('auth', 'signup', { email, password, turnstile_token, ...extra }); }
export async function getUser() { return getRequest('auth', 'get_user'); }
export async function updateProfile(full_name) { return apiCall('auth', 'update_profile', { full_name }); }
export async function changePassword(current_password, new_password) { return apiCall('auth', 'change_password', { current_password, new_password }); }
export async function requestHandoff() { return apiCall('auth', 'handoff_create', {}); }
export async function exchangeHandoff(token) { return apiCall('auth', 'handoff_exchange', { token }); }

export async function bootstrapPlatform(level) { return getVersionedRequest('platform', 'bootstrap', { level }); }
export async function getPlatformConfig(level) { return getVersionedRequest('platform', 'config', { level }); }
export async function getHeader(level) { return getVersionedRequest('platform', 'header', { level }); }
export async function getFooter(level) { return getVersionedRequest('platform', 'footer', { level }); }
export async function getLandingPage(level) { return getVersionedRequest('platform', 'landing', { level }); }
export async function getOnboardingConfig(level) { return getVersionedRequest('platform', 'onboarding_config', { level }); }
export async function getUIComponents(level) { return getVersionedRequest('platform', 'ui_components', { level }); }
export async function getPlatformSections(levelId) { return getVersionedRequest('platform', 'sections', { level_id: levelId }); }

export async function getAllSiteSections() { return getRequest('site-sections', 'get_all_site_sections'); }
export async function getSectionHeadings() { return getRequest('site-sections', 'get_section_headings'); }
export async function updateSiteSection(section, data) { return apiCall('site-sections', 'update_site_section', { section, data }); }
export async function updateSectionHeadings(headings) { return apiCall('site-sections', 'update_section_headings', { headings }); }
export async function getInfoSection(section) { return getRequest('site-sections', 'get_info_section', { section }); }
export async function getInfoSectionsList() { return getRequest('site-sections', 'get_info_sections_list'); }
export async function updateInfoSection(section, data) { return apiCall('site-sections', 'update_info_section', { section, ...data }); }

export async function getNotesList(unitId) { return getRequest('notes', 'list', { unit_id: unitId }); }
export async function getNoteDetail(id) { return getRequest('notes', 'detail', { id }); }
export async function getNoteBySlug(slug) { return getRequest('notes', 'detail', { slug }); }
export async function getRelatedNotes(noteId) { return getRequest('notes', 'related', { note_id: noteId }); }
export async function getNoteToc(noteId) { return getRequest('notes', 'toc', { note_id: noteId }); }
export async function getReadingProgress(noteId) { return getRequest('notes', 'reading_progress', { note_id: noteId }); }
export async function saveReadingProgress(noteId, scrollPercentage, scrollPosition, timeSpent, completed) { return apiCall('notes', 'save_progress', { note_id: noteId, scroll_percentage: scrollPercentage, scroll_position: scrollPosition, time_spent: timeSpent, completed }); }
export async function getContinueReading(limit = 10) { return getRequest('notes', 'continue_reading', { limit }); }
export async function getNoteDownloadUrl(id) { return getRequest('notes', 'download_url', { id }); }

export async function getNotePreview(noteId) {
  const data = await getRequest('notes', 'detail', { id: noteId });
  return { content_preview: data.content_preview, read_time: data.read_time, title: data.title };
}

export async function getNoteContent(noteId) {
  const data = await getRequest('notes', 'detail', { id: noteId });
  if (data.locked) return data;
  return data;
}

export async function getContentDetail(type, id) { return getRequest('content', 'detail', { type, id }); }
export async function getInternalLinks(type, id) { return getRequest('content', 'links', { type, id }); }
export async function getRelatedContent(type, id) { return getRequest('content', 'related', { type, id }); }
export async function toggleBookmark(type, id) { return apiCall('content', 'toggle_bookmark', { content_type: type, content_id: id }); }
export async function rateContent(type, id, rating, difficultyRating) { return apiCall('content', 'rate', { content_type: type, content_id: id, rating, difficulty_rating: difficultyRating }); }
export async function recordContentView(type, id) { return apiCall('content', 'view', { content_type: type, content_id: id }); }
export async function listCollections() { return getRequest('content', 'collections'); }
export async function getCollection(slug) { return getRequest('content', 'collection', { slug }); }

export async function getReactions(type, id) { return getRequest('interactions', 'reactions', { content_type: type, content_id: id }); }
export async function getComments(type, id) { return getRequest('interactions', 'comments', { content_type: type, content_id: id }); }
export async function getEngagementSummary(type, id) { return getRequest('interactions', 'summary', { content_type: type, content_id: id }); }
export async function toggleReaction(type, id, reaction) { return apiCall('interactions', 'toggle_reaction', { content_type: type, content_id: id, reaction_type: reaction }); }
export async function addComment(type, id, body, parentId) { return apiCall('interactions', 'add_comment', { content_type: type, content_id: id, body, parent_comment_id: parentId }); }
export async function editComment(commentId, body) { return apiCall('interactions', 'edit_comment', { id: commentId, body }); }
export async function deleteComment(commentId) { return apiCall('interactions', 'delete_comment', { id: commentId }); }
export async function getMyBookmarks() { return getRequest('interactions', 'my_bookmarks'); }
export async function getNoteReactions(noteId) { return getRequest('interactions', 'reactions', { content_type: 'note', content_id: noteId }); }
export async function toggleNoteReaction(noteId, reactionType) { return apiCall('interactions', 'toggle_reaction', { content_type: 'note', content_id: noteId, reaction_type: reactionType }); }
export async function toggleFavorite(resourceId) { return apiCall('interactions', 'toggle_favorite', { resource_id: resourceId }); }
export async function recordView(resourceId) { return apiCall('interactions', 'record_view', { resource_id: resourceId }); }
export async function recordDownload(resourceId) { return apiCall('interactions', 'record_download', { resource_id: resourceId }); }
export async function recordDailyVisit() { return apiCall('interactions', 'record_daily_visit', {}); }
export async function submitRating(resourceId, rating) { return apiCall('interactions', 'submit_rating', { resource_id: resourceId, rating }); }
export async function likeResource(resourceId) { return apiCall('interactions', 'like_resource', { resource_id: resourceId }); }
export async function commentResource(resourceId, comment) { return apiCall('interactions', 'comment_resource', { resource_id: resourceId, comment }); }
export async function getResourceInteractions(resourceId) { return getRequest('interactions', 'get_resource_interactions', { resource_id: resourceId }); }
export async function submitMood(mood, message) { return apiCall('interactions', 'submit_mood', { mood, message }); }
export async function saveAchievement(badge) { return apiCall('interactions', 'save_achievement', { badge }); }
export async function saveQuizState(state) { return apiCall('interactions', 'save_quiz_state', { state }); }
export async function getQuizState() { return getRequest('interactions', 'get_quiz_state'); }
export async function clearQuizState() { return apiCall('interactions', 'clear_quiz_state', {}); }
export async function trackEvent(eventName, eventData = {}) { return apiCall('interactions', 'track_event', { event_name: eventName, event_data: eventData }); }
export async function getPublicStats() { return getRequest('interactions', 'get_public_stats'); }
export async function getPlatformStats() { return getRequest('interactions', 'platform-stats'); }
export async function getUserDashboard() { return getRequest('interactions', 'dashboard'); }
export async function getDailyChallenge() { return getRequest('interactions', 'daily-challenge'); }
export async function getWeakAreas() { return getRequest('interactions', 'weak-areas'); }
export async function getLearningPaths(level) { return getRequest('interactions', 'learning-paths', { level }); }
export async function getPersonalRecords() { return getRequest('interactions', 'personal-records'); }
export async function getUserAchievements() { return getRequest('interactions', 'get_user_achievements'); }
export async function getUserStreak() { return getRequest('interactions', 'get_user_streak'); }
export async function getUserFavorites() { return getRequest('interactions', 'get_user_favorites'); }
export async function getRecentViews(limit = 5) { return getRequest('interactions', 'get_recent_views', { limit }); }
export async function getUserRatings() { return getRequest('interactions', 'get_user_ratings'); }
export async function getLeaderboard(level, limit = 20) { return getRequest('interactions', 'leaderboard', { level, limit }); }

export async function getRecallSession(unitId) { return getRequest('recall', 'session', { unit_id: unitId }); }
export async function checkRecallSession(unitId) { return getRequest('recall', 'session_check', { unit_id: unitId }); }
export async function checkFirstVisit(unitId) { return getRequest('recall', 'first_visit', { unit_id: unitId }); }
export async function continueRecallSession(sessionId) { return apiCall('recall', 'continue', { session_id: sessionId }); }
export async function submitRecallAnswer(sessionId, questionId, answer, nonce, startedAt) { return apiCall('recall', 'answer', { session_id: sessionId, question_id: questionId, user_answer: answer, nonce, started_at: startedAt }); }
export async function completeRecallSession(sessionId) { return apiCall('recall', 'complete', { session_id: sessionId }); }
export async function getRecallStats() { return getRequest('recall', 'stats'); }
export async function getRecallAchievements() { return getRequest('recall', 'achievements'); }
export async function getRecallDashboard() { return getRequest('recall', 'dashboard'); }
export async function getRecallTopics(groupId) { return getRequest('recall', 'topics', { group_id: groupId }); }

// The user's currently-selected level for the recall/practice feature.
// Backend-persisted under the recall module — NOT the same as the
// account-level track/level set at signup (that lives under user_profiles
// via auth.js/profile.js). This is scoped to what recall.js exposes.
// NOTE: recall.js has not been shared yet, so these two paths
// ('selected_level' / 'set_selected_level') are a best-effort guess at
// naming, matching the existing snake_case convention in this module
// ('session_check', 'first_visit', etc). Confirm against the actual
// recall.js handler and adjust the path strings below if they differ.
export async function getSelectedLevel() { return getRequest('recall', 'selected_level'); }
export async function setSelectedLevel(level) { return apiCall('recall', 'set_selected_level', { level }); }

export async function getClassroomLevels() { return getRequest('classroom', 'levels'); }
export async function getClassroomTopics(groupId, level) { return getRequest('classroom', 'topics', { group_id: groupId, level }); }
export async function listClassrooms(unitId, groupId) { return getRequest('classroom', 'list', { unit_id: unitId, group_id: groupId }); }
export async function getLiveClassroomFeed() { return getRequest('classroom', 'live_feed'); }
export async function getClassroomRoom(roomId) { return getRequest('classroom', 'room', { room_id: roomId }); }
export async function getClassroomMessages(roomId) { return getRequest('classroom', 'messages', { room_id: roomId }); }
export async function getClassroomParticipants(roomId) { return getRequest('classroom', 'participants', { room_id: roomId }); }
export async function joinClassroom(roomId) { return apiCall('classroom', 'join', { room_id: roomId }); }
export async function leaveClassroom(roomId) { return apiCall('classroom', 'leave', { room_id: roomId }); }
export async function sendClassroomMessage(roomId, message) { return apiCall('classroom', 'send_message', { room_id: roomId, message }); }
export async function raiseHand(roomId, raise) { return apiCall('classroom', 'raise_hand', { room_id, raise }); }
export async function applyAsTutor(level, className, subjects, qualifications, experience) { return apiCall('classroom', 'tutor_apply', { level, class_name: className, subjects, qualifications, experience }); }
export async function toggleClassroomMute(room_id, target_user_id, mute) { return apiCall('classroom', 'toggle_mute', { room_id, target_user_id, mute }); }
export async function endClassroom(room_id) { return apiCall('classroom', 'end_room', { room_id }); }
export async function shareClassroomResource(room_id, file_url, file_name, file_size) { return apiCall('classroom', 'share_resource', { room_id, file_url, file_name, file_size }); }
export async function fileClassroomComplaint(room_id, complaint_type, description) { return apiCall('classroom', 'file_complaint', { room_id, complaint_type, description }); }
export async function reviewTutorApplication(application_id, action, extra = {}) { return apiCall('classroom', 'tutor_review', { application_id, action, ...extra }); }
export async function getTutorStatus() { return getRequest('classroom', 'tutor_status'); }
export async function getTutorRooms() { return getRequest('classroom', 'tutor_rooms'); }
export async function createClassroom(payload) { return apiCall('classroom', 'create', payload); }
export async function adminListRooms(filters = {}) { return getRequest('classroom', 'admin_list_rooms', filters); }
export async function adminListApplications(status) { return getRequest('classroom', 'admin_list_applications', status ? { status } : {}); }
export async function adminListComplaints(status) { return getRequest('classroom', 'admin_list_complaints', status ? { status } : {}); }
export async function adminResolveComplaint(complaint_id, status, resolution) { return apiCall('classroom', 'admin_resolve_complaint', { complaint_id, status, resolution }); }
export async function adminEndClassroom(room_id) { return apiCall('classroom', 'end_room', { room_id }); }

export async function globalSearch(q, extraParams = {}) {
  const params = new URLSearchParams({ q, ...extraParams }).toString();
  return getRequest('search', `global?${params}`);
}

export async function getProfile() { return getRequest('profile', 'get_profile'); }
export async function saveOnboarding(payload) { return apiCall('profile', 'save_onboarding', payload); }
export async function updateClass(class_name) { return apiCall('profile', 'update_class', { class_name }); }
export async function switchClass(group_id) { return apiCall('profile', 'switch_class', { group_id }); }
export async function requestLevelChange(track, reason) { return apiCall('profile', 'request_level_change', { requested_track: track, reason }); }
export async function getClassSequence(track) { return getRequest('profile', 'class_sequence', { track }); }
export async function getPharmacyPrograms() { return getRequest('profile', 'pharmacy_programs'); }
export async function getLevelChangeStatus() { return getRequest('profile', 'level_change_status'); }
export async function getPendingLevelChanges() { return getRequest('profile', 'pending_level_changes'); }
export async function reviewLevelChange(request_id, action) { return apiCall('profile', 'review_level_change', { request_id, action }); }
export async function adminUpdateProfile(user_id, track, class_name) { return apiCall('profile', 'admin_update_profile', { user_id, track, class_name }); }

export async function submitContact(formData) { return apiCall('contact', 'submit_contact', { formData }); }
export async function subscribeNewsletter(email) { return apiCall('contact', 'subscribe_newsletter', { formData: { email } }); }

export async function getNotifications(params = {}) { return getRequest('recall', 'notifications', params); }
export async function markNotificationRead(id) { return apiCall('recall', 'notification_read', { notification_id: id }); }
export async function markAllNotificationsRead() { return apiCall('recall', 'notification_read_all', {}); }
export async function dismissNotification(id) { return apiCall('recall', 'notification_dismiss', { notification_id: id }); }
export async function getNotificationPreferences() { return getRequest('recall', 'notification_prefs'); }
export async function updateNotificationPreferences(prefs) { return apiCall('recall', 'notification_prefs_update', { preferences: prefs }); }

export async function getPastPapers(filters) { return getRequest('past-papers', 'get_papers', filters); }
export async function getPastPaper(id) { return getRequest('past-papers', 'get_paper', { id }); }
export async function getPastPaperFilterOptions() { return getRequest('past-papers', 'get_filter_options'); }
export async function getPastPaperDownloadUrl(id) { return getRequest('past-papers', 'get_download_url', { id }); }
export async function addPastPaper(data) { return apiCall('past-papers', 'add_paper', data); }
export async function addPastPapersBatch(papers) { return apiCall('past-papers', 'add_papers_batch', { papers }); }
export async function deletePastPaper(id) { return apiCall('past-papers', 'delete_paper', { id }); }
export async function trackPastPaperDownload(id) { return apiCall('past-papers', 'track_download', { id }); }

export async function getAdminStats() { return getRequest('admin', 'stats'); }
export async function getResourceSubmissions() { return getRequest('admin', 'submissions'); }
export async function getSubmissions() { return getResourceSubmissions(); }
export async function approveResource(submissionId, action, unitId) { return apiCall('admin', 'approve_resource', { submissionId, action, unit_id: unitId }); }
export async function getContactMessages() { return getRequest('admin', 'messages'); }
export async function getAdminUsers() { return getRequest('admin', 'get_admin_users'); }
export async function listAllUsers() { return getRequest('admin', 'list_users'); }
export async function getNewsletterSubscribers() { return getRequest('admin', 'get_newsletter_subscribers'); }
export async function getDonations() { return getRequest('admin', 'get_donations'); }
export async function getPageActivity() { return getRequest('admin', 'get_page_activity'); }
export async function getAppFeatures(pageId = 'all') { return getRequest('admin', 'get_app_features', { page_id: pageId }); }
export async function getUserActivityTrace() { return getRequest('admin', 'get_user_activity_trace'); }
export async function getAuditLog() { return getRequest('admin', 'get_audit_log'); }
export async function updateUserRole(userId, role) { return apiCall('admin', 'update_user_role', { userId, role }); }
export async function updateUserLock(userId, lock, reason) { return apiCall('admin', 'update_user_lock', { userId, lock, reason }); }
export async function updateUserRestriction(userId, restriction_type, reason, duration_hours) { return apiCall('admin', 'update_user_restriction', { userId, restriction_type, reason, duration_hours }); }
export async function updateAppFeature(feature_key, settings, is_enabled) { return apiCall('admin', 'update_app_feature', { feature_key, settings, is_enabled }); }
export async function deleteQuizTopic(unitId) { return apiCall('admin', 'delete_quiz_topic', { unit_id: unitId }); }
export async function setupMfa() { return apiCall('admin', 'setup_mfa', {}); }
export async function confirmMfa(code) { return apiCall('admin', 'confirm_mfa', { code }); }
export async function disableMfa(userId) { return apiCall('admin', 'disable_mfa', { userId }); }

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

export async function getWeeklyChallengeStatus(weekStart) { return getRequest('daily-challenge', 'status', { week_start: weekStart }); }
export async function submitWeeklyChallenge(weekStart, selectedOption) { return apiCall('daily-challenge', 'submit', { week_start: weekStart, selected_option: selectedOption }); }

export async function getCommunityActivity() { return getRequest('community', 'activity'); }

export async function uploadFile(formData) { return apiCall('upload', 'file', formData, 'POST', true); }
export async function deleteUserFile(fileId) { return deleteRequest('upload', 'file', { file_id: fileId }); }
export async function getUserFiles(category) { return getRequest('upload', 'files', category ? { category } : {}); }

export async function fetchLabTools() { return getRequest('lab', 'tools'); }
export async function fetchLabDrugs(level) { return getRequest('lab', 'drugs', level ? { level } : {}); }
export async function fetchLabInteraction(drugAId, drugBId) { return getRequest('lab', 'interactions', { drug_a_id: drugAId, drug_b_id: drugBId }); }
export async function fetchLabPathways(level) { return getRequest('lab', 'pathways', level ? { level } : {}); }
export async function fetchLabPathway(slug) { return getRequest('lab', 'pathway_by_slug', { slug }); }
export async function fetchLabCases(level, difficulty) { return getRequest('lab', 'cases', { level, difficulty }); }
export async function fetchLabCase(id) { return getRequest('lab', 'case_by_id', { id }); }
export async function submitLabScore(caseId, userId, score, maxScore) { return apiCall('lab', 'submit_score', { case_id: caseId, user_id: userId, score, max_score: maxScore }); }
export async function fetchLabFormulas(level, drug) { return getRequest('lab', 'formulas', { level, drug }); }

export async function getContentGuideImage(level, className) {
  const params = { level };
  if (className) params.class_name = className;
  return getRequest('content-guide-images', 'image', params);
}
export async function getContentGuideImages() { return getRequest('content-guide-images', 'images'); }
export async function updateContentGuideImage(level, className, imageUrl, fallbackColor, altText) { return apiCall('content-guide-images', 'image', { level, class_name: className, image_url: imageUrl, fallback_color: fallbackColor, alt_text: altText }); }
export async function deleteContentGuideImage(level, className) { return apiCall('content-guide-images', 'image', { level, class_name: className }); }

export async function uploadProfilePicture(formData) { return apiCall('profile-picture', 'upload', formData, 'POST', true); }
export async function deleteProfilePicture() { return apiCall('profile-picture', 'picture', {}); }
export async function getProfilePicture(userId) { return getRequest('profile-picture', 'picture', userId ? { user_id: userId } : {}); }

export async function getGlossaryTerms(level, category, search) { return getRequest('glossary', 'list', { level, category, search }); }
export async function getGlossaryTerm(slug, level) { return getRequest('glossary', 'term', { slug, level }); }
export async function getGlossaryCategories(level) { return getRequest('glossary', 'categories', { level }); }

export async function getResources(filters = {}) {
  const params = {};
  if (filters.unit_id) params.unit_id = filters.unit_id;
  if (filters.category) params.category = filters.category;
  return getRequest('notes', 'list', params);
}
export async function getFilterOptions() { return getRequest('notes', 'get_filter_options'); }
export async function getPdfsByLevel(unitId) { return getRequest('pdf-resources', 'list', { unit_id: unitId }); }
export async function getNotesStructure(unitId) { return getRequest('notes', 'get_notes_structure', { unit_id: unitId }); }
export async function trackPdfPreview(pdfId) { return apiCall('pdf-resources', 'track_preview', { pdf_id: pdfId }); }
export async function trackPdfDownload(pdfId) { return apiCall('pdf-resources', 'track_download', { pdf_id: pdfId }); }
export async function submitResource(payload) { return apiCall('resources', 'submit_resource', { payload }); }
export async function getAllRatings() { return getRequest('interactions', 'get_all_ratings'); }

export async function listTutors({ unit_id, country, district, teaching_mode, search, limit = 12, offset = 0 } = {}) {
  const params = {};
  if (unit_id) params.unit_id = unit_id;
  if (country) params.country = country;
  if (district) params.district = district;
  if (teaching_mode) params.teaching_mode = teaching_mode;
  if (search) params.search = search;
  if (limit !== undefined) params.limit = String(limit);
  if (offset !== undefined) params.offset = String(offset);
  return getRequest('tutors', 'list', params);
}

export async function getTutorDetail(profileId) {
  return getRequest('tutors', 'detail', { profile_id: profileId });
}

export async function getMyTutorProfile() {
  return getRequest('tutors', 'my_profile');
}

export async function createOrUpdateTutorProfile(payload) {
  return apiCall('tutors', 'create_profile', payload);
}

export async function updateTutorEmployment(employment) {
  return apiCall('tutors', 'update_employment', { employment });
}

export async function uploadVerification(fileId, verificationType) {
  return apiCall('tutors', 'upload_verification', { file_id: fileId, verification_type: verificationType });
}

export async function activateListing(profileId, paymentId) {
  return apiCall('tutors', 'activate_listing', { profile_id: profileId, payment_id: paymentId });
}

export async function sendContactRequest(tutorUserId, message) {
  return apiCall('tutors', 'contact', { tutor_id: tutorUserId, message });
}

export async function respondContactRequest(requestId, action) {
  return apiCall('tutors', 'respond_contact', { request_id: requestId, action });
}

export async function getFlashcards(filters = {}) {
  const params = {};
  if (filters.unit_id) params.unit_id = filters.unit_id;
  return getRequest('flashcards', 'list', params);
}
export async function getFlashcardDecks(filters = {}) {
  const params = {};
  if (filters.unit_id) params.unit_id = filters.unit_id;
  return getRequest('flashcards', 'decks', params);
}
export async function getFlashcardDeck(deckId) { return getRequest('flashcards', 'deck', { deck_id: deckId }); }
export async function getFlashcardActiveSession(deckId) { return getRequest('flashcards', 'active_session', deckId ? { deck_id: deckId } : {}); }
export async function getAdaptiveFlashcardDecks() { return getRequest('flashcards', 'adaptive_decks'); }
export async function startFlashcardSession(deckId, mode) { return apiCall('flashcards', 'start_session', { deck_id: deckId, mode }); }
export async function updateFlashcardSession(sessionId, cardId, correct, index) { return apiCall('flashcards', 'update_session', { session_id: sessionId, card_id: cardId, correct, current_index: index }); }
export async function completeFlashcardSession(sessionId) { return apiCall('flashcards', 'complete_session', { session_id: sessionId }); }
export async function checkFlashcardAnswer(cardId, answer, checkType) { return apiCall('flashcards', 'check_answer', { flashcard_id: cardId, user_answer: answer, check_type: checkType }); }
export async function createFlashcardDeck(title, description, category, unit_id, difficulty_confidence, card_types, cards) { return apiCall('flashcards', 'create_deck', { title, description, category, unit_id, difficulty_confidence, card_types, cards }); }
export async function updateFlashcardDeck(deckId, updates) { return apiCall('flashcards', 'update_deck', { deck_id: deckId, ...updates }); }
export async function deleteFlashcardDeck(deckId) { return apiCall('flashcards', 'delete_deck', { deck_id: deckId }); }
export async function addFlashcardCards(deckId, cards) { return apiCall('flashcards', 'add_cards', { deck_id: deckId, cards }); }
export async function removeFlashcardCard(cardId) { return apiCall('flashcards', 'remove_card', { card_id: cardId }); }
export async function getKnownFlashcards() { return getRequest('flashcards', 'known'); }
export async function toggleFlashcardKnown(flashcardId) { return apiCall('flashcards', 'toggle_known', { flashcard_id: flashcardId }); }
export async function rateFlashcard(flashcardId, difficulty) { return apiCall('flashcards', 'rate', { flashcard_id: flashcardId, difficulty }); }
export async function toggleFlashcardBookmark(flashcardId) { return apiCall('flashcards', 'toggle_bookmark', { flashcard_id: flashcardId }); }
export async function getFlashcardProgress() { return getRequest('flashcards', 'progress'); }

export async function getCurriculumLevels() { return getRequest('curriculum', 'levels'); }
export async function getGroups(levelId) { return getRequest('curriculum', 'groups', { level_id: levelId }); }
export async function getUnits({ group_id, level_id } = {}) {
  const params = {};
  if (group_id) params.group_id = group_id;
  if (level_id) params.level_id = level_id;
  return getRequest('curriculum', 'units', params);
}
export async function getUnitBreadcrumb(unitId) { return getRequest('curriculum', 'breadcrumb', { unit_id: unitId }); }

export async function getQuizTopics(unitId) { return getRequest('quiz', 'get_quiz_topics', { unit_id: unitId }); }
export async function getQuizBlock(unitId, block) { return getRequest('quiz', 'get_quiz_block', { unit_id: unitId, block_number: block }); }
export async function checkDailyRetry(unitId, block) { return getRequest('quiz', 'check_daily_retry', { unit_id: unitId, block_number: block }); }
export async function checkQuizAnswer({ question_id, selected_option }) { return apiCall('quiz', 'check_quiz_answer', { question_id, selected_option }); }
export async function startQuizSession(unitId, block, state) { return apiCall('quiz', 'quiz_start_session', { unit_id: unitId, block_number: block, state }); }
export async function trackTabSwitch(unitId, block) { return apiCall('quiz', 'quiz_tab_switch', { unit_id: unitId, block_number: block }); }
export async function submitQuizWithSession(unitId, block, answers, timeTaken) { return apiCall('quiz', 'quiz_submit_with_session', { unit_id: unitId, block_number: block, answers, time_taken: timeTaken }); }
export async function getQuizSessionStatus() { return getRequest('quiz', 'quiz_session_status'); }
export async function addQuizQuestionsBatch(unitId, questions) { return apiCall('quiz', 'add_quiz_questions_batch', { unit_id: unitId, questions }); }
