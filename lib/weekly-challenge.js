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

  // Get user's effective level if not provided
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
    // Admin or teacher with ALL access - get all challenges or let them choose
    const { data } = await supabase
      .from('weekly_challenges')
      .select('*')
      .eq('week_start', week_start)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      // Try to find by week start regardless of level
      const { data: fallback } = await supabase
        .from('weekly_challenges')
        .select('*')
        .eq('week_start', week_start)
        .maybeSingle();

      if (fallback) {
        return res.status(200).json({
          submitted: false,
          selected_option: null,
          challenge: {
            id: fallback.id,
            question: fallback.question,
            options: fallback.options || [],
            correct: fallback.correct_option,
            explanation: fallback.explanation || '',
            level: fallback.level || 'ALL',
            reward_xp: fallback.reward_xp || 50
          }
        });
      }
      return res.status(200).json({
        submitted: false,
        selected_option: null,
        challenge: null
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

  // Get weekly challenge for user's level
  const { data, error } = await supabase
    .from('weekly_challenges')
    .select('*')
    .eq('week_start', week_start)
    .eq('level', effectiveLevel)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new SecurityError('Failed to fetch weekly challenge', 500);

  // If no challenge for this level this week, try to get a generic one
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

    // Check if user has submitted anything for this week
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

  // Check if user has already submitted
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

  // Get user's effective level
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

  // Check if user already submitted for this week
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

  // Get the challenge to verify the answer and award XP
  const { data: challenge } = await supabase
    .from('weekly_challenges')
    .select('correct_option, reward_xp, level')
    .eq('week_start', week_start)
    .eq('level', effectiveLevel)
    .eq('is_active', true)
    .maybeSingle();

  // If no level-specific challenge, try generic
  const challengeData = challenge || await supabase
    .from('weekly_challenges')
    .select('correct_option, reward_xp, level')
    .eq('week_start', week_start)
    .is('level', null)
    .eq('is_active', true)
    .maybeSingle();

  const isCorrect = challengeData?.data?.correct_option === selected_option;
  const rewardXp = challengeData?.data?.reward_xp || 50;

  // Record the submission
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

  // Award XP if correct
  if (isCorrect) {
    await supabase
      .from('xp_events')
      .insert({
        user_id: ctx.userId,
        event_type: 'weekly_challenge',
        amount: rewardXp,
        created_at: new Date().toISOString()
      });

    // Update user XP
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
  }

  return res.status(200).json({
    success: true,
    already_submitted: false,
    is_correct: isCorrect,
    reward_xp: isCorrect ? rewardXp : 0
  });
}
