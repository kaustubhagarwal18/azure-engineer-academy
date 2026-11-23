// Tests for weak-topic scoring and revision recommendations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weakTopics, untouchedTopics, WEIGHTS } from '../js/core/weakTopics.js';
import { emptyState } from '../js/core/store.js';
import { recordAttempt, showNextHint, setMentorVerdict, answerQuiz, taskKey, quizKey, revealSolution } from '../js/core/progress.js';
import { loadContent } from '../js/core/content.js';
import { fetchFromDisk } from './helpers.js';

const c = await loadContent(fetchFromDisk);
const m = c.missionsById.m001;
const lockTask = m.modes.guided.tasks.find((t) => t.id === 'g6-lock');
const lockKey = taskKey('m001', 'guided', lockTask.id);

test('no activity means no weak topics, and every topic is untouched', () => {
  assert.deepEqual(weakTopics(emptyState(), c.missions), []);
  assert.ok(untouchedTopics(emptyState(), c.missions).includes('resource-locks'));
});

test('a clean first-try pass does not create a weak topic', () => {
  const s = recordAttempt(emptyState(), lockKey, 'x', { passed: true });
  assert.deepEqual(weakTopics(s, c.missions), []);
  assert.ok(!untouchedTopics(s, c.missions).includes('resource-locks'));
});

test('hints, failures, early solution reveal and mentor needs-work all add weight, with reasons', () => {
  let s = showNextHint(emptyState(), lockKey, 3);
  s = recordAttempt(s, lockKey, 'x', { passed: false });
  s = revealSolution(s, lockKey, lockTask);
  s = setMentorVerdict(s, lockKey, 'needs-work');
  const [top] = weakTopics(s, c.missions);
  assert.equal(top.topic, 'resource-locks');
  assert.equal(top.score, WEIGHTS.hintShown + WEIGHTS.failedAttempt + WEIGHTS.solutionBeforeComplete + WEIGHTS.mentorNeedsWork);
  assert.equal(top.reasons.length, 4);
});

test('failed attempts are capped so one stubborn task cannot dominate', () => {
  let s = emptyState();
  for (let i = 0; i < 50; i += 1) s = recordAttempt(s, lockKey, 'x', { passed: false });
  const [top] = weakTopics(s, c.missions);
  assert.equal(top.score, WEIGHTS.failedAttemptCap * WEIGHTS.failedAttempt);
});

test('a missed quiz question weighs its topics; a first-try correct one does not', () => {
  const q = m.quiz.find((x) => x.id === 'q3-audit-deny');
  let s = answerQuiz(emptyState(), quizKey('m001', q.id), 0, false);
  s = answerQuiz(s, quizKey('m001', q.id), q.answer, true);
  const policy = weakTopics(s, c.missions).find((e) => e.topic === 'azure-policy');
  assert.equal(policy.score, WEIGHTS.quizWrongFirstTry);
  const ok = answerQuiz(emptyState(), quizKey('m001', q.id), q.answer, true);
  assert.deepEqual(weakTopics(ok, c.missions), []);
});

test('topics are ranked by score and recommendations list unfinished tasks first', () => {
  let s = emptyState();
  s = showNextHint(s, lockKey, 3);
  const policyTask = m.modes.guided.tasks.find((t) => t.id === 'g5-policy');
  const pk = taskKey('m001', 'guided', policyTask.id);
  s = revealSolution(recordAttempt(s, pk, 'x', { passed: false }), pk, policyTask);
  const ranked = weakTopics(s, c.missions);
  assert.equal(ranked[0].topic === 'azure-policy' || ranked[0].topic === 'tags', true);
  assert.ok(ranked.findIndex((e) => e.topic === 'resource-locks') > 0);
  s = recordAttempt(s, lockKey, 'x', { passed: true });
  const locks = weakTopics(s, c.missions).find((e) => e.topic === 'resource-locks');
  const done = locks.recommend.map((r) => r.complete);
  assert.deepEqual(done, [...done].sort((a, b) => Number(a) - Number(b)), 'incomplete first');
});
