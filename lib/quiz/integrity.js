/* lib/quiz/integrity.js */
import { supabase } from '../core.js';
import {
  requireAuth,
  SecurityError,
  rateLimiter
} from '../security-middleware.js';
import { createNotification } from '../notifications.js';
import { getUserCurriculumScope } from '../curriculum.js';
import { checkUnitBlockAccess } from '../premium.js';
import {
  getStoredIdempotencyResponse,
  createIdempotencyKey
} from './idempotency.js';

const INTEGRITY_LOCK_HOURS = 48;
const BLOCK_TIME_LIMIT_SECONDS = 600;
const BLOCK_TIME_GRACE_SECONDS = 15;

export async function trackTabSwitch(body, res, ctx) {
  requireAuth(ctx);

  const { unit_id, block_number, idempotency_key } = body;

  if (!unit_id || block_number === undefined) {
    throw new SecurityError('unit_id and block_number required', 400);
  }

  const blockNum = Number.parseInt(block_number, 10);

  if (!Number.isInteger(blockNum) || blockNum < 0) {
    throw new SecurityError('Invalid block_number', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_tab_switch'))) {
    throw new SecurityError('Too many tab switch events', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(
      ctx.userId,
      'quiz_tab_switch',
      idempotency_key
    );

    if (stored) return res.status(200).json(stored);
  }

  const unit = await getUnitWithValidation(ctx, unit_id, blockNum);
  const session = await getSession(ctx, unit.id, blockNum);

  if (!session) {
    throw new SecurityError('No active session found for this block', 403);
  }

  if (session.auto_submitted) {
    return res.status(200).json({
      success: false,
      auto_submitted: true,
      message: 'This block was already auto-submitted.'
    });
  }

  const elapsed = secondsElapsed(session);

  if (elapsed > BLOCK_TIME_LIMIT_SECONDS + BLOCK_TIME_GRACE_SECONDS) {
    await expireSession(ctx, unit, blockNum, session, 'time_expired');

    return res.status(200).json({
      success: false,
      auto_submitted: true,
      reason: 'time_expired'
    });
  }

  const newCount = (session.tab_switches || 0) + 1;
  const maxAllowed = session.max_tab_switches || 3;

  const timestamps = Array.isArray(session.state?.tab_switch_timestamps)
    ? [...session.state.tab_switch_timestamps]
    : [];

  timestamps.push(new Date().toISOString());

  if (newCount >= maxAllowed) {
    const updatedState = {
      ...(typeof session.state === 'object' && session.state !== null
        ? session.state
        : {}),
      tab_switch_timestamps: timestamps,
      auto_submitted_at: new Date().toISOString(),
      auto_submit_reason: 'tab_switch'
    };

    const { error: sessionUpdateError } = await supabase
      .from('user_quiz_sessions')
      .update({
        tab_switches: newCount,
        auto_submitted: true,
        state: updatedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)
      .eq('user_id', ctx.userId);

    if (sessionUpdateError) {
      console.error(
        '[QUIZ_TAB_SWITCH] session update error',
        sessionUpdateError.message
      );

      throw new SecurityError(
        'Failed to update quiz session',
        500
      );
    }

    await supabase.from('quiz_security_logs').insert({
      user_id: ctx.userId,
      event_type: 'tab_switch_auto_submit',
      details: {
        unit_id,
        block_number: blockNum,
        tab_switches: newCount,
        max_allowed: maxAllowed
      }
    });

    await supabase.from('quiz_session_events').insert({
      session_id: session.id,
      user_id: ctx.userId,
      event_type: 'auto_submitted',
      metadata: {
        tab_switches: newCount,
        max_allowed: maxAllowed
      }
    });

    await createNotification(ctx.userId, 'quiz_auto_submitted', {
      topic_name: session.topic || '',
      block_number: blockNum + 1
    });

    const response = {
      success: false,
      auto_submitted: true,
      message: `Your quiz was auto-submitted after ${newCount} tab switches. Locked for ${INTEGRITY_LOCK_HOURS} hours.`,
      tab_switches: newCount,
      max_allowed: maxAllowed,
      redirect_after_seconds: 10
    };

    if (idempotency_key) {
      await createIdempotencyKey(
        ctx.userId,
        'quiz_tab_switch',
        idempotency_key,
        response,
        200
      );
    }

    return res.status(200).json(response);
  }

  const updatedState = {
    ...(typeof session.state === 'object' && session.state !== null
      ? session.state
      : {}),
    tab_switch_timestamps: timestamps,
    last_tab_switch: new Date().toISOString()
  };

  const { error: sessionUpdateError } = await supabase
    .from('user_quiz_sessions')
    .update({
      tab_switches: newCount,
      state: updatedState,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('user_id', ctx.userId);

  if (sessionUpdateError) {
    console.error(
      '[QUIZ_TAB_SWITCH] session update error',
      sessionUpdateError.message
    );

    throw new SecurityError(
      'Failed to update quiz session',
      500
    );
  }

  await supabase.from('quiz_session_events').insert({
    session_id: session.id,
    user_id: ctx.userId,
    event_type: 'tab_switch',
    metadata: {
      tab_switches: newCount,
      remaining: maxAllowed - newCount
    }
  });

  const response = {
    success: true,
    tab_switches: newCount,
    max_allowed: maxAllowed,
    remaining: maxAllowed - newCount
  };

  if (idempotency_key) {
    await createIdempotencyKey(
      ctx.userId,
      'quiz_tab_switch',
      idempotency_key,
      response,
      200
    );
  }

  return res.status(200).json(response);
}

export async function recordHeartbeat(body, res, ctx) {
  requireAuth(ctx);

  const {
    session_id,
    client_timestamp,
    idempotency_key
  } = body;

  if (!session_id) {
    throw new SecurityError('session_id required', 400);
  }

  const ip = ctx.clientIp || 'unknown';

  if (!(await rateLimiter.check(ip, ctx.userId, 'quiz_heartbeat'))) {
    throw new SecurityError('Too many heartbeat requests', 429);
  }

  if (idempotency_key) {
    const stored = await getStoredIdempotencyResponse(
      ctx.userId,
      'quiz_heartbeat',
      idempotency_key
    );

    if (stored) return res.status(200).json(stored);
  }

  const { data: session, error: sessionError } = await supabase
    .from('user_quiz_sessions')
    .select('id, user_id, auto_submitted, status')
    .eq('id', session_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (sessionError) {
    console.error(
      '[QUIZ_HEARTBEAT] session lookup error',
      sessionError.message
    );

    throw new SecurityError(
      'Failed to verify quiz session',
      500
    );
  }

  if (!session) {
    throw new SecurityError('Quiz session not found', 404);
  }

  if (session.auto_submitted || session.status !== 'active') {
    throw new SecurityError('Quiz session is no longer active', 403);
  }

  const { error: heartbeatError } = await supabase.rpc(
    'atomic_record_quiz_heartbeat',
    {
      p_session_id: session.id,
      p_user_id: ctx.userId,
      p_client_timestamp: client_timestamp || null
    }
  );

  if (heartbeatError) {
    console.error(
      '[QUIZ_HEARTBEAT] RPC error',
      heartbeatError.message
    );

    throw new SecurityError(
      'Failed to record quiz heartbeat',
      500
    );
  }

  const response = {
    success: true,
    server_time: new Date().toISOString()
  };

  if (idempotency_key) {
    await createIdempotencyKey(
      ctx.userId,
      'quiz_heartbeat',
      idempotency_key,
      response,
      200
    );
  }

  return res.status(200).json(response);
}

async function getUnitWithValidation(ctx, unitId, blockNumber) {
  const scope = await getUserCurriculumScope(ctx.userId);

  if (!scope?.active_group_id) {
    throw new SecurityError(
      'Your curriculum context is not set.',
      403
    );
  }

  const { data: unit, error: unitError } = await supabase
    .from('curriculum_units')
    .select(
      'id, name, group_id, curriculum_groups!inner(level_id, name, curriculum_levels(id, display_name, unit_label, group_label, icon, color))'
    )
    .eq('id', unitId)
    .eq('group_id', scope.active_group_id)
    .eq('is_active', true)
    .maybeSingle();

  if (unitError) {
    console.error(
      '[QUIZ_INTEGRITY] unit lookup error',
      unitError.message
    );

    throw new SecurityError(
      'Failed to verify quiz unit',
      500
    );
  }

  if (!unit) {
    throw new SecurityError(
      'Unit not found or not available in your curriculum.',
      404
    );
  }

  if (blockNumber !== null) {
    const { data: authUser } =
      await supabase.auth.admin.getUserById(ctx.userId);

    const access = await checkUnitBlockAccess(
      authUser?.user?.email || null,
      ctx.userId,
      unit.id,
      blockNumber
    );

    if (!access.allowed) {
      if (access.reason === 'restricted') {
        throw new SecurityError(
          'Your access to this content has been restricted.',
          403
        );
      }

      throw new SecurityError(
        'This block requires premium access.',
        403
      );
    }
  }

  const group = unit.curriculum_groups;
  const level = group?.curriculum_levels || null;

  return {
    id: unit.id,
    name: unit.name,
    groupId: unit.group_id,
    groupName: group?.name || null,
    levelId: level?.id || null,
    levelName: level?.display_name || null,
    level
  };
}

async function getSession(ctx, unitId, blockNumber) {
  const { data, error } = await supabase
    .from('user_quiz_sessions')
    .select('*')
    .eq('user_id', ctx.userId)
    .eq('unit_id', unitId)
    .eq('block_number', blockNumber)
    .maybeSingle();

  if (error) {
    console.error(
      '[QUIZ_INTEGRITY] session lookup error',
      error.message
    );

    throw new SecurityError(
      'Failed to load quiz session',
      500
    );
  }

  return data || null;
}

function secondsElapsed(session) {
  const startedStr =
    session.started_at ||
    session.state?.started_at ||
    session.created_at ||
    session.updated_at;

  const started = new Date(startedStr).getTime();

  if (!Number.isFinite(started)) {
    return 0;
  }

  return Math.floor((Date.now() - started) / 1000);
}

async function expireSession(ctx, unit, blockNumber, session, reason) {
  const updatedState = {
    ...(typeof session.state === 'object' && session.state !== null
      ? session.state
      : {}),
    auto_submitted_at: new Date().toISOString(),
    auto_submit_reason: reason
  };

  const { error: updateError } = await supabase
    .from('user_quiz_sessions')
    .update({
      auto_submitted: true,
      status: 'auto_submitted',
      state: updatedState,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.id)
    .eq('user_id', ctx.userId);

  if (updateError) {
    console.error(
      '[QUIZ_INTEGRITY] expire session update error',
      updateError.message
    );

    throw new SecurityError(
      'Failed to expire quiz session',
      500
    );
  }

  await supabase.from('quiz_session_events').insert({
    session_id: session.id,
    user_id: ctx.userId,
    event_type: 'session_expired',
    metadata: {
      reason,
      unit_id: unit.id,
      block_number: blockNumber
    }
  });

  await createNotification(ctx.userId, 'quiz_auto_submitted', {
    topic_name: unit.name,
    block_number: blockNumber + 1
  });
}
