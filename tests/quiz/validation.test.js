/* tests/quiz/validation.test.js */
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeQuestionSet, validateBlockNumber } from '../../lib/quiz/validation.js';

test('normalizes and deduplicates question ids', () => {
  const ids = ['11', 11, 12, '13'];

  assert.deepEqual(normalizeQuestionSet(ids), [11, 12, 13]);
});

test('filters invalid question ids', () => {
  const ids = ['1', 2, 'bad', 0, -1, '3'];

  assert.deepEqual(normalizeQuestionSet(ids), [1, 2, 3]);
});

test('accepts valid block number', () => {
  assert.equal(validateBlockNumber('2'), 2);
});

test('rejects negative block number', () => {
  assert.throws(() => validateBlockNumber('-1'), /Invalid block_number/);
});
