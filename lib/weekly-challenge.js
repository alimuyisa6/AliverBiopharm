 import { supabase } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  SecurityError,
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'status') {
    requireAuth(ctx);
    return getChallengeStatus(req, res, ctx);
  }
  if (req.method === 'POST' && path === 'submit') {
    requireAuth(ctx);
    const body = await parseAndValidateBody(req);
    return submitChallenge(body, res, ctx);
  }
  throw new SecurityError('Method not allowed', 405);
}

async function getChallengeStatus(req, res, ctx) {
  const { week_start, unit_id } = req.query;
  if (!week_start) throw new SecurityError('week_start required', 400);

  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) {
    return res.status(200).json({
      submitted: false,
      selected_option: null,
      challenge: null,
      message: 'Your curriculum context is not set.',
    });
  }

  let query = supabase
    .from('weekly_challenges')
    .select('*')
    .eq('week_start', week_start)
    .eq('is_active', true);

  if (unit_id) {
    const { data: unit } = await supabase
      .from('curriculum_units')
      .select('id')
      .eq('id', unit_id)
      .eq('group_id', scope.active_group_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!unit) {
      return res.status(200).json({
        submitted: false,
        selected_option: null,
        challenge: null,
        message: 'No challenge available for this unit.',
      });
    }
    query = query.eq('unit_id', unit_id);
  } else {
    query = query.eq('group_id', scope.active_group_id);
  }

  const { data: challenge, error } = await query.maybeSingle();

  if (error) throw new SecurityError('Failed to fetch weekly challenge', 500);
  if (!challenge) {
    return res.status(200).json({
      submitted: false,
      selected_option: null,
      challenge: null,
      message: 'No challenge available for this week in your programme.',
    });
  }

  const { data: submission } = await supabase
    .from('user_interactions')
    .select('metadata')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'weekly_challenge')
    .filter('metadata->>week_start', 'eq', week_start)
    .filter('metadata->>group_id', 'eq', scope.active_group_id)
    .maybeSingle();

  if (submission) {
    return res.status(200).json({
      submitted: true,
      selected_option: submission.metadata?.selected_option ?? null,
      challenge: {
        id: challenge.id,
        question: challenge.question,
        options: challenge.options || [],
        correct: challenge.correct_option,
        explanation: challenge.explanation || '',
        reward_xp: challenge.reward_xp || 50,
      },
    });
  }

  return res.status(200).json({
    submitted: false,
    selected_option: null,
    challenge: {
      id: challenge.id,
      question: challenge.question,
      options: challenge.options || [],
      correct: challenge.correct_option,
      explanation: challenge.explanation || '',
      reward_xp: challenge.reward_xp || 50,
    },
  });
}

async function submitChallenge(body, res, ctx) {
  const { week_start, selected_option, unit_id } = body;
  if (!week_start || selected_option === undefined) {
    throw new SecurityError('week_start and selected_option required', 400);
  }

  const scope = await getUserCurriculumScope(ctx.userId);
  if (!scope || !scope.active_group_id) {
    throw new SecurityError('Your curriculum context is not set.', 400);
  }

  const metadataMatch = { week_start, group_id: scope.active_group_id };
  if (unit_id) metadataMatch.unit_id = unit_id;

  const { data: existing } = await supabase
    .from('user_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'weekly_challenge')
    .filter('metadata->>week_start', 'eq', week_start)
    .filter('metadata->>group_id', 'eq', scope.active_group_id)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({
      success: true,
      already_submitted: true,
      message: "You have already submitted this week's challenge.",
    });
  }

  let challengeQuery = supabase
    .from('weekly_challenges')
    .select('correct_option, reward_xp, id')
    .eq('week_start', week_start)
    .eq('is_active', true);

  if (unit_id) {
    challengeQuery = challengeQuery.eq('unit_id', unit_id);
  } else {
    challengeQuery = challengeQuery.eq('group_id', scope.active_group_id);
  }

  const { data: challenge } = await challengeQuery.maybeSingle();
  if (!challenge) throw new SecurityError('Challenge not found', 404);

  const isCorrect = challenge.correct_option === selected_option;
  const rewardXp = isCorrect ? challenge.reward_xp || 50 : 0;

  const { error: insertError } = await supabase
    .from('user_interactions')
    .insert({
      user_id: ctx.userId,
      interaction_type: 'weekly_challenge',
      metadata: {
        week_start,
        selected_option,
        group_id: scope.active_group_id,
        unit_id: unit_id || null,
        is_correct: isCorrect,
        reward_xp: rewardXp,
      },
    });

  if (insertError) throw new SecurityError('Failed to submit challenge', 500);

  if (isCorrect) {
    await supabase.from('xp_events').insert({
      user_id: ctx.userId,
      event_type: 'weekly_challenge',
      amount: rewardXp,
      created_at: new Date().toISOString(),
    });

    const { data: current } = await supabase
      .from('user_xp')
      .select('total_xp')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    const newTotal = (current?.total_xp || 0) + rewardXp;
    await supabase.from('user_xp').upsert(
      {
        user_id: ctx.userId,
        total_xp: newTotal,
        level: Math.floor(newTotal / 100) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  }

  return res.status(200).json({
    success: true,
    already_submitted: false,
    is_correct: isCorrect,
    reward_xp: rewardXp,
  });
}
