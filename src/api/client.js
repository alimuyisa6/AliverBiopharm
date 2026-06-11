const API_BASE = '/api/query';

async function apiCall(action, body = {}) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, ...body })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json.data !== undefined ? json.data : json;
}

export async function signup(email, password) { return apiCall('signup', { email, password }); }
export async function signin(email, password) { return apiCall('signin', { email, password }); }
export async function signout() { return apiCall('signout'); }
export async function getUser() { return apiCall('get_user'); }
export async function getAllSiteSections() { return apiCall('get_all_site_sections'); }
export async function submitWeeklyChallenge(weekStart, selectedOption) { return apiCall('submit_weekly_challenge', { week_start: weekStart, selected_option: selectedOption }); }
export async function getPdfsByLevel(level) { return apiCall('get_pdfs_by_level', { level }); }
export async function trackPdfPreview(pdfId) { return apiCall('track_pdf_preview', { pdf_id: pdfId }); }
export async function trackPdfDownload(pdfId) { return apiCall('track_pdf_download', { pdf_id: pdfId }); }
export async function getNotesStructure() { return apiCall('get_notes_structure'); }
export async function getNoteContent(subtopicId) { return apiCall('get_note_content', { subtopic_id: subtopicId }); }
export async function getResources(filters = {}) { return apiCall('get_resources', filters); }
export async function getFilterOptions() { return apiCall('get_filter_options'); }
export async function submitContact(formData) { return apiCall('submit_contact', { formData }); }
export async function subscribeNewsletter(email) { return apiCall('subscribe_newsletter', { formData: { email } }); }
export async function getFlashcards() { return apiCall('get_flashcards'); }
export async function getPublicStats() { return apiCall('get_public_stats'); }
export async function getCommunityActivity() { return apiCall('get_community_activity'); }
export async function getKnownFlashcards() { return apiCall('get_known_flashcards'); }
export async function toggleFlashcardKnown(flashcardId) { return apiCall('toggle_flashcard_known', { flashcard_id: flashcardId }); }
export async function rateFlashcard(flashcardId, difficulty) { return apiCall('rate_flashcard', { flashcard_id: flashcardId, difficulty }); }
export async function checkFlashcardAnswer(flashcardId, userAnswer) { return apiCall('check_flashcard_answer', { flashcard_id: flashcardId, user_answer: userAnswer }); }
export async function toggleFlashcardBookmark(flashcardId) { return apiCall('toggle_flashcard_bookmark', { flashcard_id: flashcardId }); }
export async function likeResource(resourceId) { return apiCall('like_resource', { resource_id: resourceId }); }
export async function commentResource(resourceId, comment) { return apiCall('comment_resource', { resource_id: resourceId, comment }); }
export async function getResourceInteractions(resourceId) { return apiCall('get_resource_interactions', { resource_id: resourceId }); }
export async function submitMood(mood, message) { return apiCall('submit_mood', { mood, message }); }
export async function getNoteReactions(noteId) { return apiCall('get_note_reactions', { note_id: noteId }); }
export async function toggleNoteReaction(noteId, reactionType) { return apiCall('toggle_note_reaction', { note_id: noteId, reaction_type: reactionType }); }
export async function requestChat() { return apiCall('request_chat'); }
export async function getChatMessages(roomId) { return apiCall('get_chat_messages', { room_id: roomId }); }
export async function sendChatMessage(roomId, message) { return apiCall('send_chat_message', { room_id: roomId, message }); }
export async function deleteChatMessage(messageId) { return apiCall('delete_chat_message', { message_id: messageId }); }
export async function checkAdminOnline() { return apiCall('check_admin_online'); }
export async function updateUserPresence() { return apiCall('update_user_presence'); }
export async function getRecentViews(limit = 3) { return apiCall('get_recent_views', { limit }); }
export async function getUserFavorites() { return apiCall('get_user_favorites'); }
export async function getUserStreak() { return apiCall('get_user_streak'); }
export async function getUserAchievements() { return apiCall('get_user_achievements'); }
export async function saveReadingProgress(noteId, scrollPercentage, scrollPosition, timeSpent, completed = false) { return apiCall('save_reading_progress', { note_id: noteId, scroll_percentage: scrollPercentage, scroll_position: scrollPosition, time_spent: timeSpent, completed }); }
export async function getReadingProgress(noteId) { return apiCall('get_reading_progress', { note_id: noteId }); }
