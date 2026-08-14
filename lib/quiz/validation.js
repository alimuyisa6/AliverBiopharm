/* lib/quiz/validation.js */
import { SecurityError } from '../security-middleware.js';

export function validateOption(value) {
  const option = String(value || '').trim().toUpperCase();

  if (!['A', 'B', 'C', 'D'].includes(option)) {
    throw new SecurityError('Invalid selected_option', 400);
  }

  return option;
}

export function getSessionQuestionIds(session) {
  if (Array.isArray(session?.state?.question_ids) && session.state.question_ids.length) {
    return session.state.question_ids.map((id) => Number(id));
  }

  if (Array.isArray(session?.question_ids) && session.question_ids.length) {
    return session.question_ids.map((id) => Number(id));
  }

  if (Array.isArray(session?.all_question_ids) && session.all_question_ids.length) {
    return session.all_question_ids.map((id) => Number(id));
  }

  return [];
}

export function normalizeQuestionSet(questionIds) {
  return [...new Set((questionIds || []).map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
}

export function validateBlockNumber(value) {
  const block = Number.parseInt(value, 10);

  if (!Number.isInteger(block) || block < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  return block;
}
