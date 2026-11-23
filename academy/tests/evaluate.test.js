// Tests for answer normalisation and rule checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../js/core/evaluate.js';
import { normalizeAnswer, paragraphs, parseInline } from '../js/core/text.js';

const require_ = (id, pattern, flags) => ({ id, kind: 'require', pattern, flags, description: id, mistake: `${id} wrong` });
const forbid = (id, pattern, flags) => ({ id, kind: 'forbid', pattern, flags, description: id, mistake: `${id} wrong` });

test('normalizeAnswer joins shell line continuations so multi-line commands match', () => {
  const answer = 'az group create \\\n  --name rg \\\r\n\t--location westeurope';
  assert.equal(normalizeAnswer(answer), 'az group create --name rg --location westeurope');
});

test('normalizeAnswer keeps real newlines and treats null/undefined as empty', () => {
  assert.equal(normalizeAnswer('a\nb'), 'a\nb');
  assert.equal(normalizeAnswer(null), '');
  assert.equal(normalizeAnswer(undefined), '');
});

test('require passes on a match and fails with the mistake text otherwise', () => {
  const checks = [require_('cmd', '\\baz group create\\b')];
  assert.equal(evaluate('az group create -n x', checks).passed, true);
  const r = evaluate('az group list', checks);
  assert.equal(r.passed, false);
  assert.equal(r.results[0].mistake, 'cmd wrong');
});

test('forbid fails when the pattern is present', () => {
  const checks = [require_('cmd', 'az'), forbid('owner', '--role\\s+Owner', 'i')];
  assert.equal(evaluate('az role assignment create --role owner', checks).passed, false);
  assert.equal(evaluate('az role assignment create --role Reader', checks).passed, true);
});

test('flags are honoured (case-insensitive only when asked)', () => {
  assert.equal(evaluate('CANNOTDELETE', [require_('c', 'CanNotDelete')]).passed, false);
  assert.equal(evaluate('CANNOTDELETE', [require_('c', 'CanNotDelete', 'i')]).passed, true);
});

for (const blank of ['', ' ', '\n\t\n', null, undefined]) {
  test(`an empty answer (${JSON.stringify(blank)}) never passes, even with only forbid checks`, () => {
    const r = evaluate(blank, [forbid('x', 'Owner')]);
    assert.equal(r.empty, true);
    assert.equal(r.passed, false);
    assert.equal(r.results[0].passed, false);
  });
}

test('every check reports, not just the first failure', () => {
  const r = evaluate('nothing', [require_('a', 'x'), require_('b', 'y'), require_('c', 'nothing')]);
  assert.deepEqual(r.results.map((x) => x.passed), [false, false, true]);
});

test('paragraphs splits on blank lines and drops empties', () => {
  assert.deepEqual(paragraphs('one\n\n two \n\n\n\nthree'), ['one', 'two', 'three']);
  assert.deepEqual(paragraphs(''), []);
});

test('parseInline separates `code` from text and keeps an unmatched backtick literal', () => {
  assert.deepEqual(parseInline('run `az login` now'), [
    { type: 'text', value: 'run ' }, { type: 'code', value: 'az login' }, { type: 'text', value: ' now' },
  ]);
  assert.deepEqual(parseInline('a ` b'), [{ type: 'text', value: 'a ` b' }]);
  assert.deepEqual(parseInline('`x`'), [{ type: 'code', value: 'x' }]);
});
