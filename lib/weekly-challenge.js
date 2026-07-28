 import { supabase, canAccessLevel, isAdmin, isValidLevel } from './core.js';
import { parseAndValidateBody, requireAuth, SecurityError } from './security-middleware.js';

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
  const { week_start, level } = req.query;
  if (!week_start) throw new SecurityError('week_start required', 400);

  let effectiveLevel = level;
  if (!effectiveLevel) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track, role, is_approved_teacher, approved_track')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (profile) {
      if (profile.role === 'student') {
        effectiveLevel = profile.track;
      } else if (profile.role === 'teacher') {
        if (profile.is_approved_teacher) {
          if (profile.approved_track === 'ALL') {
            effectiveLevel = 'ALL';
          } else {
            effectiveLevel = profile.approved_track || profile.track;
          }
        }
      }
    }
  }

  if (!effectiveLevel || effectiveLevel === 'ALL') {
    const { data } = await supabase
      .from('weekly_challenges')
      .select('*')
      .eq('week_start', week_start)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      return res.status(200).json({
        submitted: false,
        selected_option: null,
        challenge: null,
        message: 'No challenge available for this week.'
      });
    }

    return res.status(200).json({
      submitted: false,
      selected_option: null,
      challenge: {
        id: data.id,
        question: data.question,
        options: data.options || [],
        correct: data.correct_option,
        explanation: data.explanation || '',
        level: data.level || 'ALL',
        reward_xp: data.reward_xp || 50
      }
    });
  }

  const { data, error } = await supabase
    .from('weekly_challenges')
    .select('*')
    .eq('week_start', week_start)
    .eq('level', effectiveLevel)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch weekly challenge', 500);

  if (!data) {
    const { data: generic } = await supabase
      .from('weekly_challenges')
      .select('*')
      .eq('week_start', week_start)
      .is('level', null)
      .eq('is_active', true)
      .maybeSingle();

    if (generic) {
      return res.status(200).json({
        submitted: false,
        selected_option: null,
        challenge: {
          id: generic.id,
          question: generic.question,
          options: generic.options || [],
          correct: generic.correct_option,
          explanation: generic.explanation || '',
          level: null,
          reward_xp: generic.reward_xp || 50
        }
      });
    }

    const { data: existing } = await supabase
      .from('user_interactions')
      .select('metadata')
      .eq('user_id', ctx.userId)
      .eq('interaction_type', 'weekly_challenge')
      .filter('metadata->>week_start', 'eq', week_start)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({
        submitted: true,
        selected_option: existing.metadata?.selected_option ?? null,
        challenge: null
      });
    }

    return res.status(200).json({
      submitted: false,
      selected_option: null,
      challenge: null,
      message: 'No challenge available for your level this week.'
    });
  }

  const { data: submission } = await supabase
    .from('user_interactions')
    .select('metadata')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'weekly_challenge')
    .filter('metadata->>week_start', 'eq', week_start)
    .filter('metadata->>level', 'eq', effectiveLevel)
    .maybeSingle();

  if (submission) {
    return res.status(200).json({
      submitted: true,
      selected_option: submission.metadata?.selected_option ?? null,
      challenge: {
        id: data.id,
        question: data.question,
        options: data.options || [],
        correct: data.correct_option,
        explanation: data.explanation || '',
        level: data.level || effectiveLevel,
        reward_xp: data.reward_xp || 50
      }
    });
  }

  return res.status(200).json({
    submitted: false,
    selected_option: null,
    challenge: {
      id: data.id,
      question: data.question,
      options: data.options || [],
      correct: data.correct_option,
      explanation: data.explanation || '',
      level: data.level || effectiveLevel,
      reward_xp: data.reward_xp || 50
    }
  });
}

async function submitChallenge(body, res, ctx) {
  const { week_start, selected_option, level } = body;
  if (!week_start || selected_option === undefined) {
    throw new SecurityError('week_start and selected_option required', 400);
  }

  let effectiveLevel = level;
  if (!effectiveLevel) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('track, role, is_approved_teacher, approved_track')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (profile) {
      if (profile.role === 'student') {
        effectiveLevel = profile.track;
      } else if (profile.role === 'teacher') {
        if (profile.is_approved_teacher) {
          if (profile.approved_track === 'ALL') {
            effectiveLevel = 'ALL';
          } else {
            effectiveLevel = profile.approved_track || profile.track;
          }
        }
      }
    }
  }

  if (!effectiveLevel) throw new SecurityError('Unable to determine your level', 400);

  const { data: existing } = await supabase
    .from('user_interactions')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('interaction_type', 'weekly_challenge')
    .filter('metadata->>week_start', 'eq', week_start)
    .filter('metadata->>level', 'eq', effectiveLevel)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({
      success: true,
      already_submitted: true,
      message: 'You have already submitted this week\'s challenge.'
    });
  }

  const { data: challenge } = await supabase
    .from('weekly_challenges')
    .select('correct_option, reward_xp, level')
    .eq('week_start', week_start)
    .eq('level', effectiveLevel)
    .eq('is_active', true)
    .maybeSingle();

  let challengeData = challenge;
  if (!challengeData) {
    const { data: generic } = await supabase
      .from('weekly_challenges')
      .select('correct_option, reward_xp, level')
      .eq('week_start', week_start)
      .is('level', null)
      .eq('is_active', true)
      .maybeSingle();
    challengeData = generic;
  }

  const isCorrect = challengeData?.correct_option === selected_option;
  const rewardXp = challengeData?.reward_xp || 50;

  const { error } = await supabase
    .from('user_interactions')
    .insert({
      user_id: ctx.userId,
      interaction_type: 'weekly_challenge',
      metadata: {
        week_start,
        selected_option,
        level: effectiveLevel,
        is_correct: isCorrect,
        reward_xp: isCorrect ? rewardXp : 0
      }
    });

  if (error) throw new SecurityError('Failed to submit challenge', 500);

  if (isCorrect) {
    await supabase
      .from('xp_events')
      .insert({
        user_id: ctx.userId,
        event_type: 'weekly_challenge',
        amount: rewardXp,
        created_at: new Date().toISOString()
      });

    const { data: current } = await supabase
      .from('user_xp')
      .select('total_xp')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    const newTotal = (current?.total_xp || 0) + rewardXp;
    await supabase
      .from('user_xp')
      .upsert({
        user_id: ctx.userId,
        total_xp: newTotal,
        level: Math.floor(newTotal / 100) + 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    await supabase
      .from('user_interactions')
      .update({
        metadata: {
          week_start,
          selected_option,
          level: effectiveLevel,
          is_correct: true,
          reward_xp: rewardXp,
          xp_awarded_at: new Date().toISOString()
        }
      })
      .eq('user_id', ctx.userId)
      .eq('interaction_type', 'weekly_challenge')
      .filter('metadata->>week_start', 'eq', week_start)
      .filter('metadata->>level', 'eq', effectiveLevel);
  }

  return res.status(200).json({
    success: true,
    already_submitted: false,
    is_correct: isCorrect,
    reward_xp: isCorrect ? rewardXp : 0
  });
}
