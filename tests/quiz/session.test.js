/* tests/quiz/session.test.js */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getSessionQuestionIds } from '../../lib/quiz/validation.js';

test('returns question ids from state.question_ids', () => {
  const session = {
    state: {
      question_ids: ['21', '22', '23']
    }
  };

  assert.deepEqual(getSessionQuestionIds(session), [21, 22, 23]);
});

test('returns question ids from legacy question_ids', () => {
  const session = {
    question_ids: [31, 32, 33]
  };

  assert.deepEqual(getSessionQuestionIds(session), [31, 32, 33]);
});

test('returns question ids from legacy all_question_ids', () => {
  const session = {
    all_question_ids: [41, 42]
  };

  assert.deepEqual(getSessionQuestionIds(session), [41, 42]);
});

test('returns empty array when no question ids exist', () => {
  assert.deepEqual(getSessionQuestionIds({}), []);
});
