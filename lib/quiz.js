 /* lib/quiz.js */
import {
  parseAndValidateBody,
  requireAuth,
  requireAdmin,
  SecurityError
} from './security-middleware.js';
import {
  getQuizTopics,
  listQuizTopics,
  getQuizBlock,
  checkDailyRetry,
  getSessionStatus,
  startSession
} from './quiz/session.js';
import {
  submitAnswer
} from './quiz/answers.js';
import {
  submitWithSession
} from './quiz/submission.js';
import {
  trackTabSwitch,
  recordHeartbeat
} from './quiz/integrity.js';
import {
  addQuestionsBatch
} from './quiz/questions.js';
import {
  getQuizAttempts,
  getQuizAttempt
} from './quiz/attempts.js';
import {
  getQuizMastery
} from './quiz/mastery.js';
import {
  retryWrongQuestions,
  getDueReviewQuestions,
  getBookmarks,
  bookmarkQuestion,
  removeBookmark,
  getQuestionNote,
  saveQuestionNote,
  deleteQuestionNote
} from './quiz/review.js';
import {
  getQuestionStats
} from './quiz/analytics.js';

export async function handler(req, res, path, ctx) {
  const startedAt = Date.now();

  try {
    if (req.method === 'GET') {
      requireAuth(ctx);

      switch (path) {
        case 'get_quiz_topics':
          return await getQuizTopics(req, res, ctx);
        case 'list_quiz_topics':
          return await listQuizTopics(req, res, ctx);
        case 'get_quiz_block':
          return await getQuizBlock(req, res, ctx);
        case 'check_daily_retry':
          return await checkDailyRetry(req, res, ctx);
        case 'quiz_session_status':
          return await getSessionStatus(req, res, ctx);
        case 'quiz_attempts':
          return await getQuizAttempts(req, res, ctx);
        case 'quiz_attempt':
          return await getQuizAttempt(req, res, ctx);
        case 'quiz_due_reviews':
          return await getDueReviewQuestions(req, res, ctx);
        case 'quiz_bookmarks':
          return await getBookmarks(req, res, ctx);
        case 'quiz_question_note':
          return await getQuestionNote(req, res, ctx);
        case 'quiz_mastery':
          return await getQuizMastery(req, res, ctx);
        case 'quiz_question_stats':
          return await getQuestionStats(req, res, ctx);
        default:
          throw new SecurityError('Invalid action', 400);
      }
    }

    if (req.method === 'POST') {
      const body = await parseAndValidateBody(req);

      switch (path) {
        case 'quiz_start_session':
          requireAuth(ctx);
          return await startSession(body, res, ctx);
        case 'quiz_check_answer':
          requireAuth(ctx);
          return await submitAnswer(body, res, ctx);
        case 'quiz_tab_switch':
          requireAuth(ctx);
          return await trackTabSwitch(body, res, ctx);
        case 'quiz_submit_with_session':
          requireAuth(ctx);
          return await submitWithSession(body, res, ctx);
        case 'quiz_heartbeat':
          requireAuth(ctx);
          return await recordHeartbeat(body, res, ctx);
        case 'quiz_retry_wrong':
          requireAuth(ctx);
          return await retryWrongQuestions(body, res, ctx);
        case 'bookmark_question':
          requireAuth(ctx);
          return await bookmarkQuestion(body, res, ctx);
        case 'remove_bookmark':
          requireAuth(ctx);
          return await removeBookmark(body, res, ctx);
        case 'save_question_note':
          requireAuth(ctx);
          return await saveQuestionNote(body, res, ctx);
        case 'delete_question_note':
          requireAuth(ctx);
          return await deleteQuestionNote(body, res, ctx);
        case 'add_quiz_questions_batch':
          requireAdmin(ctx);
          return await addQuestionsBatch(body, res);
        default:
          throw new SecurityError('Invalid action', 400);
      }
    }

    throw new SecurityError('Method not allowed', 405);
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    console.error('[QUIZ_ERROR]', JSON.stringify({
      request_id: ctx.requestId || null,
      user_id: ctx.userId || null,
      action: path,
      method: req.method,
      error_name: err.name || null,
      error_message: err.message || null,
      status_code: err.statusCode || 500,
      duration_ms: durationMs
    }));

    if (err instanceof SecurityError) throw err;

    throw new SecurityError('An unexpected quiz error occurred', 500);
  }
}
