  const API_BASE = '/api';

async function apiCall(endpoint, path, body = {}, method = 'POST') {
  const url = `${API_BASE}/${endpoint}?path=${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: method === 'POST' ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data !== undefined ? json.data : json;
}

async function getRequest(endpoint, path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${endpoint}?path=${path}${query ? `&${query}` : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data !== undefined ? json.data : json;
}

export { getRequest, apiCall };

export async function signup(email, password, turnstile_token) { return apiCall('auth', 'signup', { email, password, turnstile_token }); }
export async function signin(email, password, turnstile_token) { return apiCall('auth', 'signin', { email, password, turnstile_token }); }
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
export async function deleteQuizTopic(topic, level) { return apiCall('admin', 'delete_quiz_topic', { topic, level }); }

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

export async function getFlashcards() { return getRequest('flashcards', 'list'); }
export async function getFlashcardDecks() { return getRequest('flashcards', 'decks'); }
export async function getFlashcardDeck(deckId) { return getRequest('flashcards', 'deck', { deck_id: deckId }); }
export async function createFlashcardDeck(title, description, category, level, cards) { return apiCall('flashcards', 'create_deck', { title, description, category, level, cards }); }
export async function updateFlashcardDeck(deckId, title, description, category, level, cards) { return apiCall('flashcards', 'update_deck', { deck_id: deckId, title, description, category, level, cards }); }
export async function deleteFlashcardDeck(deckId) { return apiCall('flashcards', 'delete_deck', { deck_id: deckId }); }
export async function addFlashcardCards(deckId, cards) { return apiCall('flashcards', 'add_cards', { deck_id: deckId, cards }); }
export async function removeFlashcardCard(cardId) { return apiCall('flashcards', 'remove_card', { card_id: cardId }); }
export async function getKnownFlashcards() { return getRequest('flashcards', 'known'); }
export async function toggleFlashcardKnown(flashcardId) { return apiCall('flashcards', 'toggle_known', { flashcard_id: flashcardId }); }
export async function rateFlashcard(flashcardId, difficulty) { return apiCall('flashcards', 'rate', { flashcard_id: flashcardId, difficulty }); }
export async function checkFlashcardAnswer(flashcardId, userAnswer) { return apiCall('flashcards', 'check_answer', { flashcard_id: flashcardId, user_answer: userAnswer }); }
export async function toggleFlashcardBookmark(flashcardId) { return apiCall('flashcards', 'toggle_bookmark', { flashcard_id: flashcardId }); }
export async function getFlashcardProgress() { return getRequest('flashcards', 'progress'); }

export async function getCommunityActivity() { return getRequest('community', 'activity'); }

export async function getLeaderboard(level, limit = 20) { return getRequest('stats', 'leaderboard', { level, limit }); }

export async function uploadFile(fileName, fileData) { return apiCall('upload', 'upload_file', { file_name: fileName, file_data: fileData }); }
