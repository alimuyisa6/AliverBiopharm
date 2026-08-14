/* lib/quiz/questions.js */
import { supabase } from '../core.js';
import {
  requireAdmin,
  SecurityError
} from '../security-middleware.js';
import crypto from 'crypto';

export async function addQuestionsBatch(body, res, ctx) {
  requireAdmin(ctx);

  const { unit_id, questions } = body;

  if (!unit_id || !Array.isArray(questions) || !questions.length) {
    throw new SecurityError('unit_id and questions array required', 400);
  }

  const { data: unit } = await supabase
    .from('curriculum_units')
    .select('id')
    .eq('id', unit_id)
    .maybeSingle();

  if (!unit) throw new SecurityError('Curriculum unit not found', 404);

  const prepared = [];

  for (const question of questions) {
    const normalized = normalizeQuestionPayload(question);

    if (normalized.error) {
      throw new SecurityError(normalized.error, 400);
    }

    const duplicateWarning = await detectDuplicateQuestion(unit_id, normalized.payload);

    prepared.push({
      ...normalized.payload,
      duplicate_warning: duplicateWarning
    });
  }

  const rows = prepared.map((item) => ({
    unit_id,
    question_text: item.question_text,
    option_a: item.option_a,
    option_b: item.option_b,
    option_c: item.option_c,
    option_d: item.option_d,
    correct_option: item.correct_option,
    explanation: item.explanation || '',
    difficulty: item.difficulty || 'medium',
    image_url: item.image_url || null,
    image_alt_text: item.image_alt_text || null,
    concept_id: item.concept_id || null,
    concept_name: item.concept_name || null,
    subtopic: item.subtopic || null,
    learning_objective: item.learning_objective || null,
    status: 'draft',
    version: 1,
    content_hash: item.content_hash
  }));

  const { data: inserted, error } = await supabase
    .from('quiz_questions')
    .insert(rows)
    .select('id, status, version, content_hash');

  if (error) throw new SecurityError('Failed to add questions', 500);

  return res.status(200).json({
    success: true,
    inserted: inserted || [],
    duplicate_warnings: prepared.map((item) => item.duplicate_warning).filter(Boolean)
  });
}

export async function createQuestionRevision(questionId, updatedQuestion) {
  const normalized = normalizeQuestionPayload(updatedQuestion);

  if (normalized.error) {
    throw new SecurityError(normalized.error, 400);
  }

  const { data: current } = await supabase
    .from('quiz_questions')
    .select('version, content_hash')
    .eq('id', questionId)
    .maybeSingle();

  if (!current) throw new SecurityError('Question not found', 404);

  const nextVersion = Number(current.version || 1) + 1;
  const contentHash = hashQuestionPayload(normalized.payload);

  await supabase.from('quiz_question_revisions').insert({
    question_id: questionId,
    version: nextVersion,
    question_text: normalized.payload.question_text,
    option_a: normalized.payload.option_a,
    option_b: normalized.payload.option_b,
    option_c: normalized.payload.option_c,
    option_d: normalized.payload.option_d,
    correct_option: normalized.payload.correct_option,
    explanation: normalized.payload.explanation || null,
    difficulty: normalized.payload.difficulty || 'medium',
    image_url: normalized.payload.image_url || null,
    content_hash: contentHash
  });

  return { version: nextVersion, content_hash: contentHash };
}

function normalizeQuestionPayload(question) {
  if (!question?.question_text?.trim()) {
    return { error: 'question_text is required' };
  }

  if (!question.option_a?.trim()) return { error: 'option_a is required' };
  if (!question.option_b?.trim()) return { error: 'option_b is required' };
  if (!question.option_c?.trim()) return { error: 'option_c is required' };
  if (!question.option_d?.trim()) return { error: 'option_d is required' };

  const correctOption = String(question.correct_option || '').trim().toUpperCase();

  if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
    return { error: 'correct_option must be A, B, C, or D' };
  }

  const difficulty = question.difficulty || 'medium';

  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return { error: 'difficulty must be easy, medium, or hard' };
  }

  const payload = {
    question_text: question.question_text.trim(),
    option_a: question.option_a.trim(),
    option_b: question.option_b.trim(),
    option_c: question.option_c.trim(),
    option_d: question.option_d.trim(),
    correct_option: correctOption,
    explanation: question.explanation?.trim() || null,
    difficulty,
    image_url: question.image_url || null,
    image_alt_text: question.image_alt_text || null,
    concept_id: question.concept_id || null,
    concept_name: question.concept_name || null,
    subtopic: question.subtopic || null,
    learning_objective: question.learning_objective || null,
    content_hash: hashQuestionPayload(question)
  };

  return { payload };
}

function hashQuestionPayload(question) {
  const content = [
    question.question_text,
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
    question.correct_option
  ]
    .map((item) => String(item || '').trim().toLowerCase())
    .join('|');

  return crypto.createHash('sha256').update(content).digest('hex');
}

async function detectDuplicateQuestion(unitId, question) {
  const { data } = await supabase
    .from('quiz_questions')
    .select('id, content_hash')
    .eq('unit_id', unitId)
    .eq('content_hash', question.content_hash)
    .maybeSingle();

  return data?.id || null;
}
