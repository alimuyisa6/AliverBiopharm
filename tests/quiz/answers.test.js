/* tests/quiz/answers.test.js */
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOption } from '../../lib/quiz/validation.js';

test('accepts valid lower-case option', () => {
  assert.equal(validateOption('a'), 'A');
});

test('accepts valid upper-case option', () => {
  assert.equal(validateOption('B'), 'B');
});

test('rejects invalid option', () => {
  assert.throws(() => validateOption('E'), /Invalid selected_option/);
});

test('rejects empty option', () => {
  assert.throws(() => validateOption(''), /Invalid selected_option/);
});
