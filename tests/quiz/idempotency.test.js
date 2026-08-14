/* tests/quiz/idempotency.test.js */
import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';

function hashRequest(endpoint, idempotencyKey) {
  return crypto
    .createHash('sha256')
    .update(`${endpoint}:${idempotencyKey}`)
    .digest('hex');
}

test('produces stable request hash', () => {
  const first = hashRequest('quiz_start_session', 'abc123');
  const second = hashRequest('quiz_start_session', 'abc123');

  assert.equal(first, second);
});

test('produces different hashes for different keys', () => {
  const first = hashRequest('quiz_start_session', 'abc123');
  const second = hashRequest('quiz_start_session', 'abc124');

  assert.notEqual(first, second);
});
