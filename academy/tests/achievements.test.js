// Tests that achievements are earned only by genuine completion and are derived, not stored.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAchievements, ACHIEVEMENTS } from '../js/core/achievements.js';
import { emptyState } from '../js/core/store.js';
import { recordAttempt, showNextHint, setMentorVerdict, answerQuiz, taskKey, quizKey, revealSolution } from '../js/core/progress.js';
import { loadContent } from '../js/core/content.js';
import { fetchFromDisk } from './helpers.js';

const c = await loadContent(fetchFromDisk);
const ctx = { missions: c.missions, domains: c.domains, missionsById: c.missionsById };
const m = c.missionsById.m001;
const PASS = { passed: true };
const FAIL = { passed: false };

/** Look up one achievement's evaluation by id. */
const get = (state, id) => evaluateAchievements(state, ctx).find((a) => a.id === id);

test('nothing is earned on an empty state', () => {
  assert.deepEqual(evaluateAchievements(emptyState(), ctx).filter((a) => a.earned), []);
});

test('ids are unique and every achievement states its criteria', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of ACHIEVEMENTS) assert.ok(a.criteria && a.title && a.icon);
});

test('attempting (without passing) earns nothing', () => {
  let s = emptyState();
  for (const t of m.modes.guided.tasks) s = recordAttempt(s, taskKey('m001', 'guided', t.id), 'x', FAIL);
  assert.equal(get(s, 'first-solve').earned, false);
});

test('first solve needs a genuinely completed task', () => {
  const s = recordAttempt(emptyState(), taskKey('m001', 'guided', 'g1-resource-group'), 'x', PASS);
  assert.equal(get(s, 'first-solve').earned, true);
});

test('unassisted ignores tasks where hints were opened or the solution was seen first', () => {
  let s = emptyState();
  const [t1, t2, t3, t4] = m.modes.guided.tasks;
  s = recordAttempt(s, taskKey('m001', 'guided', t1.id), 'x', PASS);
  s = recordAttempt(s, taskKey('m001', 'guided', t2.id), 'x', PASS);
  s = showNextHint(s, taskKey('m001', 'guided', t3.id), 3);
  s = recordAttempt(s, taskKey('m001', 'guided', t3.id), 'x', PASS);
  const k4 = taskKey('m001', 'guided', t4.id);
  s = revealSolution(recordAttempt(s, k4, 'x', FAIL), k4, t4);
  s = recordAttempt(s, k4, 'x', PASS);
  assert.equal(get(s, 'unassisted').earned, false);
  assert.equal(get(s, 'unassisted').detail, '2 / 3 tasks');
});

test('incident responder needs mentor passes, not keyword checks', () => {
  let s = emptyState();
  for (const t of m.modes.incident.tasks) s = recordAttempt(s, taskKey('m001', 'incident', t.id), 'x', PASS);
  assert.equal(get(s, 'incident-responder').earned, false);
  for (const t of m.modes.incident.tasks) s = setMentorVerdict(s, taskKey('m001', 'incident', t.id), 'pass');
  assert.equal(get(s, 'incident-responder').earned, true);
});

test('quiz ace is lost on a wrong first answer even if later corrected', () => {
  let s = emptyState();
  for (const [i, q] of m.quiz.entries()) {
    if (i === 0) s = answerQuiz(s, quizKey('m001', q.id), (q.answer + 1) % q.options.length, false);
    s = answerQuiz(s, quizKey('m001', q.id), q.answer, true);
  }
  assert.equal(get(s, 'quiz-ace').earned, false);
});

test('mission complete needs every mode and the whole quiz; domain specialist stays locked while missions are unpublished', () => {
  let s = emptyState();
  for (const mode of ['guided', 'independent', 'incident']) {
    for (const t of m.modes[mode].tasks) s = setMentorVerdict(s, taskKey('m001', mode, t.id), 'pass');
  }
  assert.equal(get(s, 'mission-complete').earned, false, 'quiz not done yet');
  for (const q of m.quiz) s = answerQuiz(s, quizKey('m001', q.id), q.answer, true);
  assert.equal(get(s, 'mission-complete').earned, true);
  assert.equal(get(s, 'quiz-ace').earned, true);
  assert.equal(get(s, 'domain-specialist').earned, false, 'M002 and M003 are not published yet');
});

test('a mentor "needs work" takes an earned achievement away again', () => {
  const k = taskKey('m001', 'guided', 'g1-resource-group');
  let s = recordAttempt(emptyState(), k, 'x', PASS);
  assert.equal(get(s, 'first-solve').earned, true);
  s = setMentorVerdict(s, k, 'needs-work');
  assert.equal(get(s, 'first-solve').earned, false);
});
