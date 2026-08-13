 /* lib/daily-challenge.js */
import { supabase, addXp, recordPlatformActivity } from './core.js';
import {
  parseAndValidateBody,
  requireAuth,
  SecurityError
} from './security-middleware.js';
import { getUserCurriculumScope } from './curriculum.js';

export async function handler(req, res, path, ctx) {
  if (req.method === 'GET' && path === 'status') {
    requireAuth(ctx);
    return getDailyChallengeStatus(req, res, ctx);
  }

  if (req.method === 'POST' && path === 'submit') {
    requireAuth(ctx);

    const body = await parseAndValidateBody(req);
    return submitDailyChallenge(body, res, ctx);
  }

  throw new SecurityError('Method not allowed', 405);
}

async function getDailyChallengeStatus(req, res, ctx) {
  const scope = await getUserCurriculumScope(ctx.userId);
  const groupId = scope?.active_group_id;

  if (!groupId) {
    return res.status(200).json({
      available: false,
      challenge: null,
      progress: null
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', today)
    .maybeSingle();

  if (!challenge) {
    return res.status(200).json({
      available: false,
      challenge: null,
      progress: null
    });
  }

  const { data: progress } = await supabase
    .from('user_challenge_progress')
    .select('progress, completed, completed_at')
    .eq('user_id', ctx.userId)
    .eq('challenge_id', challenge.id)
    .maybeSingle();

  return res.status(200).json({
    available: true,
    challenge,
    progress: progress || {
      progress: 0,
      completed: false,
      completed_at: null
    }
  });
}

async function submitDailyChallenge(body, res, ctx) {
  const { challenge_id, amount = 1 } = body;

  if (!challenge_id) {
    throw new SecurityError('challenge_id required', 400);
  }

  const { data: challenge } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('id', challenge_id)
    .maybeSingle();

  if (!challenge) {
    throw new SecurityError('Challenge not found', 404);
  }

  const { data: existing } = await supabase
    .from('user_challenge_progress')
    .select('progress, completed')
    .eq('user_id', ctx.userId)
    .eq('challenge_id', challenge_id)
    .maybeSingle();

  if (existing?.completed) {
    return res.status(200).json({
      success: true,
      already_completed: true,
      progress: existing.progress,
      target: challenge.requirement_target,
      completed: true
    });
  }

  const newProgress = Math.min(
    challenge.requirement_target,
    (existing?.progress || 0) + Math.max(0, Math.trunc(amount))
  );

  const completed = newProgress >= challenge.requirement_target;

  await supabase.from('user_challenge_progress').upsert({
    user_id: ctx.userId,
    challenge_id,
    progress: newProgress,
    completed,
    completed_at: completed ? new Date().toISOString() : null
  }, { onConflict: 'user_id,challenge_id' });

  if (completed) {
    const today = new Date().toISOString().slice(0, 10);

    await supabase.from('user_daily_challenge_completions').insert({
      user_id: ctx.userId,
      completed_date: today,
      completed_at: new Date().toISOString()
    }).select().single();

    await addXp(
      ctx.userId,
      challenge.reward_xp,
      'daily_challenge',
      'daily_challenge',
      { challenge_id: challenge.id },
      null,
      challenge.group_id,
      null
    );

    await recordPlatformActivity(ctx.userId);
  }

  return res.status(200).json({
    success: true,
    progress: newProgress,
    target: challenge.requirement_target,
    completed,
    reward_xp: completed ? challenge.reward_xp : 0
  });
}
