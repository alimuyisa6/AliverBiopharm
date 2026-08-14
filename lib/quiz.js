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
  startSession,
  submitAnswer,
  trackTabSwitch,
  submitWithSession,
  addQuestionsBatch
} from './quiz/index.js';

export async function handler(req, res, path, ctx) {
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
          return await handleHeartbeat(body, res, ctx);
        case 'quiz_attempts':
          requireAuth(ctx);
          return await getQuizAttempts(req, res, ctx);
        case 'quiz_attempt':
          requireAuth(ctx);
          return await getQuizAttempt(req, res, ctx);
        case 'quiz_retry_wrong':
          requireAuth(ctx);
          return await retryWrongQuestions(body, res, ctx);
        case 'quiz_due_reviews':
          requireAuth(ctx);
          return await getDueReviewQuestions(req, res, ctx);
        case 'quiz_bookmarks':
          requireAuth(ctx);
          return await getBookmarks(req, res, ctx);
        case 'bookmark_question':
          requireAuth(ctx);
          return await bookmarkQuestion(body, res, ctx);
        case 'remove_bookmark':
          requireAuth(ctx);
          return await removeBookmark(body, res, ctx);
        case 'quiz_question_note':
          requireAuth(ctx);
          return await getQuestionNote(req, res, ctx);
        case 'save_question_note':
          requireAuth(ctx);
          return await saveQuestionNote(body, res, ctx);
        case 'delete_question_note':
          requireAuth(ctx);
          return await deleteQuestionNote(body, res, ctx);
        case 'quiz_mastery':
          requireAuth(ctx);
          return await getQuizMastery(req, res, ctx);
        case 'quiz_question_stats':
          requireAuth(ctx);
          return await getQuestionStats(req, res, ctx);
        case 'add_quiz_questions_batch':
          requireAdmin(ctx);
          return await addQuestionsBatch(body, res);
        default:
          throw new SecurityError('Invalid action', 400);
      }
    }

    throw new SecurityError('Method not allowed', 405);
  } catch (err) {
    console.error(`[quiz:${path}]`, err);

    if (err instanceof SecurityError) throw err;

    throw new SecurityError('An unexpected error occurred', 500);
  }
}

async function handleHeartbeat(body, res, ctx) {
  const heartbeatModule = await import('./quiz/integrity.js');
  return heartbeatModule.recordHeartbeat(body, res, ctx);
}

async function getQuizAttempts(req, res, ctx) {
  const attemptsModule = await import('./quiz/attempts.js');
  return attemptsModule.getQuizAttempts(req, res, ctx);
}

async function getQuizAttempt(req, res, ctx) {
  const attemptsModule = await import('./quiz/attempts.js');
  return attemptsModule.getQuizAttempt(req, res, ctx);
}

async function retryWrongQuestions(body, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.retryWrongQuestions(body, res, ctx);
}

async function getDueReviewQuestions(req, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.getDueReviewQuestions(req, res, ctx);
}

async function getBookmarks(req, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.getBookmarks(req, res, ctx);
}

async function bookmarkQuestion(body, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.bookmarkQuestion(body, res, ctx);
}

async function removeBookmark(body, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.removeBookmark(body, res, ctx);
}

async function getQuestionNote(req, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.getQuestionNote(req, res, ctx);
}

async function saveQuestionNote(body, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.saveQuestionNote(body, res, ctx);
}

async function deleteQuestionNote(body, res, ctx) {
  const reviewModule = await import('./quiz/review.js');
  return reviewModule.deleteQuestionNote(body, res, ctx);
}

async function getQuizMastery(req, res, ctx) {
  const masteryModule = await import('./quiz/mastery.js');
  return masteryModule.getQuizMastery(req, res, ctx);
}

async function getQuestionStats(req, res, ctx) {
  const analyticsModule = await import('./quiz/analytics.js');
  return analyticsModule.getQuestionStats(req, res, ctx);
}
