// Tests for progress transitions, completion rules and weighted progress.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  taskKey, taskRecord, isTaskComplete, recordAttempt, showNextHint, canRevealSolution, revealSolution,
  setMentorVerdict, answerQuiz, modeProgress, missionFraction, domainFraction, overallFraction, quizKey,
} from '../js/core/progress.js';
import { emptyState } from '../js/core/store.js';
import { loadContent } from '../js/core/content.js';
import { makeMission, makeTask, fetchFromDisk } from './helpers.js';

const PASS = { passed: true };
const FAIL = { passed: false };
const KEY = taskKey('m900', 'guided', 'g1');

test('transitions never mutate the state passed in', () => {
  const s0 = emptyState();
  const frozen = JSON.stringify(s0);
  recordAttempt(s0, KEY, 'x', FAIL);
  showNextHint(s0, KEY, 3);
  setMentorVerdict(s0, KEY, 'pass');
  answerQuiz(s0, 'm900/q1', 0, true);
  assert.equal(JSON.stringify(s0), frozen);
});

test('attempts count failures, and a pass is remembered after a later failure', () => {
  let s = recordAttempt(emptyState(), KEY, 'a', FAIL);
  s = recordAttempt(s, KEY, 'b', PASS);
  s = recordAttempt(s, KEY, 'c', FAIL);
  const r = taskRecord(s, KEY);
  assert.equal(r.attempts, 3);
  assert.equal(r.failedAttempts, 2);
  assert.equal(r.autoPassed, true);
  assert.equal(r.lastAnswer, 'c');
});

test('hints reveal one at a time and stop at the number available', () => {
  let s = emptyState();
  for (let i = 0; i < 5; i += 1) s = showNextHint(s, KEY, 3);
  assert.equal(taskRecord(s, KEY).hintsShown, 3);
});

test('the solution cannot be revealed before a submitted attempt', () => {
  const task = makeTask();
  const s0 = emptyState();
  assert.equal(canRevealSolution(taskRecord(s0, KEY)), false);
  assert.equal(revealSolution(s0, KEY, task), s0, 'no-op without an attempt');
  const s1 = revealSolution(recordAttempt(s0, KEY, 'x', FAIL), KEY, task);
  assert.equal(taskRecord(s1, KEY).solutionRevealed, true);
  assert.equal(taskRecord(s1, KEY).solutionBeforeComplete, true);
});

test('revealing after solving is not counted as revealing before completion', () => {
  const s = revealSolution(recordAttempt(emptyState(), KEY, 'x', PASS), KEY, makeTask());
  assert.equal(taskRecord(s, KEY).solutionBeforeComplete, false);
});

// Completion truth table: [review, autoPassed, mentor] -> complete
const table = [
  ['auto', false, null, false],
  ['auto', true, null, true],
  ['auto', true, 'needs-work', false],
  ['auto', false, 'pass', true],
  ['auto', false, 'needs-work', false],
  ['mentor', true, null, false],
  ['mentor', false, 'pass', true],
  ['mentor', true, 'needs-work', false],
];
for (const [review, autoPassed, mentor, expected] of table) {
  test(`complete(review=${review}, autoPassed=${autoPassed}, mentor=${mentor}) is ${expected}`, () => {
    const record = { ...taskRecord(emptyState(), KEY), autoPassed, mentor };
    assert.equal(isTaskComplete(makeTask({ review }), record), expected);
  });
}

test('an untouched task is not complete', () => {
  assert.equal(isTaskComplete(makeTask(), undefined), false);
});

test('quiz: only the first answer decides firstTryCorrect', () => {
  let s = answerQuiz(emptyState(), 'k', 1, false);
  s = answerQuiz(s, 'k', 0, true);
  assert.deepEqual(s.quiz.k, { attempts: 2, firstTryCorrect: false, lastChoice: 0, correct: true });
});

test('mission fraction counts tasks and quiz questions equally', () => {
  const mission = makeMission();
  let s = emptyState();
  assert.equal(missionFraction(s, mission), 0);
  s = recordAttempt(s, taskKey('m900', 'guided', 'g1'), 'x', PASS);
  assert.equal(missionFraction(s, mission), 1 / 4);
  assert.deepEqual(modeProgress(s, mission, 'guided'), { done: 1, total: 1 });
  s = answerQuiz(s, quizKey('m900', 'q1'), 0, true);
  assert.equal(missionFraction(s, mission), 2 / 4);
});

test('planned missions without content count as 0, so a domain is not complete early', () => {
  const mission = makeMission();
  const domain = { id: 'd', weight: [20, 25], missions: [{ id: 'm900' }, { id: 'm901' }] };
  let s = emptyState();
  for (const mode of ['guided', 'independent', 'incident']) {
    const id = { guided: 'g1', independent: 'i1', incident: 'p1' }[mode];
    s = recordAttempt(s, taskKey('m900', mode, id), 'x', PASS);
  }
  s = answerQuiz(s, quizKey('m900', 'q1'), 0, true);
  assert.equal(missionFraction(s, mission), 1);
  assert.equal(domainFraction(s, domain, { m900: mission }), 0.5);
});

test('overall progress weights domains by exam-weight midpoints', () => {
  const m = makeMission();
  const full = { ...emptyState() };
  let s = full;
  for (const [mode, id] of [['guided', 'g1'], ['independent', 'i1'], ['incident', 'p1']]) s = recordAttempt(s, taskKey('m900', mode, id), 'x', PASS);
  s = answerQuiz(s, quizKey('m900', 'q1'), 0, true);
  const domains = [
    { id: 'a', weight: [20, 25], missions: [{ id: 'm900' }] },
    { id: 'b', weight: [10, 15], missions: [{ id: 'm999' }] },
  ];
  assert.equal(overallFraction(s, domains, { m900: m }), 22.5 / (22.5 + 12.5));
});

test('real content: an empty learner shows 0% overall, and finishing M001 is not 100%', async () => {
  const c = await loadContent(fetchFromDisk);
  assert.equal(overallFraction(emptyState(), c.domains, c.missionsById), 0);
  let s = emptyState();
  for (const m of c.missions) {
    for (const mode of ['guided', 'independent', 'incident']) {
      for (const t of m.modes[mode].tasks) s = setMentorVerdict(s, taskKey(m.id, mode, t.id), 'pass');
    }
    for (const q of m.quiz) s = answerQuiz(s, quizKey(m.id, q.id), q.answer, true);
  }
  const overall = overallFraction(s, c.domains, c.missionsById);
  assert.ok(overall > 0 && overall < 0.15, `M001 alone should be a small slice of AZ-104, got ${overall}`);
});
