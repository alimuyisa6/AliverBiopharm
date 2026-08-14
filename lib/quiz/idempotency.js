/* lib/quiz/idempotency.js */
import { supabase } from '../core.js';

export async function getStoredIdempotencyResponse(userId, endpoint, idempotencyKey) {
  if (!userId || !endpoint || !idempotencyKey) return null;

  const { data, error } = await supabase.rpc('atomic_get_quiz_idempotency', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_endpoint: endpoint
  });

  if (error) return null;

  return data || null;
}

export async function createIdempotencyKey(userId, endpoint, idempotencyKey, response, statusCode) {
  if (!userId || !endpoint || !idempotencyKey) return null;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc('atomic_store_quiz_idempotency', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_endpoint: endpoint,
    p_request_hash: hashRequest(endpoint, idempotencyKey),
    p_response: response || {},
    p_status_code: statusCode || 200,
    p_expires_at: expiresAt
  });

  if (error) return null;

  return data || response || {};
}

function hashRequest(endpoint, idempotencyKey) {
  return `${endpoint}:${idempotencyKey}`;
}
