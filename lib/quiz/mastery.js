/* lib/quiz/mastery.js */
import { supabase } from '../core.js';
import {
  requireAuth,
  SecurityError
} from '../security-middleware.js';
import { getUserCurriculumScope } from '../curriculum.js';

export async function getQuizMastery(req, res, ctx) {
  requireAuth(ctx);

  const { unit_id, concept_id } = req.query;

  let query = supabase
    .from('quiz_mastery')
    .select('id, unit_id, group_id, level_id, concept_id, concept_name, attempts, correct_attempts, accuracy, mastery_score, mastery_state, last_attempted_at, last_correct_at, last_incorrect_at, updated_at')
    .eq('user_id', ctx.userId)
    .order('updated_at', { ascending: false });

  if (unit_id) query = query.eq('unit_id', unit_id);
  if (concept_id) query = query.eq('concept_id', concept_id);

  const { data, error } = await query;

  if (error) {
    console.error('[QUIZ_MASTERY]', error.message);
    throw new SecurityError('Failed to load quiz mastery', 500);
  }

  return res.status(200).json(data || []);
}

export async function updateQuizMasteryForQuestion({
  userId,
  unitId,
  groupId,
  levelId,
  conceptId,
  conceptName,
  correct,
  accuracy
}) {
  const masteryScore = Math.max(0, Math.min(100, Number(accuracy) || 0));

  const { error } = await supabase.rpc('atomic_update_quiz_mastery', {
    p_user_id: userId,
    p_unit_id: unitId || null,
    p_group_id: groupId || null,
    p_level_id: levelId || null,
    p_concept_id: conceptId || null,
    p_concept_name: conceptName || null,
    p_correct: !!correct,
    p_mastery_score: masteryScore
  });

  if (error) {
    console.error('[updateQuizMasteryForQuestion]', error.message);
  }
}

export function resolveConceptFromQuestion(question) {
  if (question?.concept_id) {
    return {
      concept_id: question.concept_id,
      concept_name: question.concept_name || null
    };
  }

  if (question?.concept_name) {
    return {
      concept_id: null,
      concept_name: question.concept_name
    };
  }

  if (question?.subtopic) {
    return {
      concept_id: null,
      concept_name: question.subtopic
    };
  }

  if (question?.learning_objective) {
    return {
      concept_id: null,
      concept_name: question.learning_objective
    };
  }

  return {
    concept_id: null,
    concept_name: null
  };
}
