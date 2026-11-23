// Tests for hash routing and the task status / next-task helpers the UI relies on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, href } from '../js/core/router.js';
import { taskStatus, nextTask, taskRecord, recordAttempt, setMentorVerdict, taskKey } from '../js/core/progress.js';
import { emptyState } from '../js/core/store.js';
import { makeMission, makeTask } from './helpers.js';

const cases = [
  ['', 'dashboard', {}],
  ['#', 'dashboard', {}],
  ['#/', 'dashboard', {}],
  ['#/revision', 'revision', {}],
  ['#/achievements/', 'achievements', {}],
  ['#/settings', 'settings', {}],
  ['#/domain/storage', 'domain', { domainId: 'storage' }],
  ['#/mission/m001', 'mission', { missionId: 'm001' }],
  ['#/mission/m001/quiz', 'quiz', { missionId: 'm001' }],
  ['#/mission/m001/guided/g1-resource-group', 'task', { missionId: 'm001', mode: 'guided', taskId: 'g1-resource-group' }],
  ['#/mission/m001/incident/p1', 'task', { missionId: 'm001', mode: 'incident', taskId: 'p1' }],
  ['#/mission/m001/expert/g1', 'not-found', {}],
  ['#/mission', 'not-found', {}],
  ['#/nope', 'not-found', {}],
  ['#/domain/%E0%A4%A', 'not-found', {}],
  ['#/mission/m001/guided/g1/extra', 'not-found', {}],
];
for (const [hash, name, params] of cases) {
  test(`parseRoute(${JSON.stringify(hash)}) -> ${name}`, () => {
    assert.deepEqual(parseRoute(hash), { name, params });
  });
}

test('href builders round-trip through parseRoute, including characters that need encoding', () => {
  assert.deepEqual(parseRoute(href.task('m 1', 'guided', 'a/b')).params, { missionId: 'm 1', mode: 'guided', taskId: 'a/b' });
  assert.equal(parseRoute(href.quiz('m001')).name, 'quiz');
  assert.equal(parseRoute(href.domain('storage')).params.domainId, 'storage');
  assert.equal(parseRoute(href.dashboard()).name, 'dashboard');
});

test('taskStatus covers every state a learner can reach', () => {
  const auto = makeTask();
  const mentor = makeTask({ review: 'mentor' });
  const k = 'k';
  const blank = taskRecord(emptyState(), k);
  const tried = taskRecord(recordAttempt(emptyState(), k, 'x', { passed: false }), k);
  const passed = taskRecord(recordAttempt(emptyState(), k, 'x', { passed: true }), k);
  assert.equal(taskStatus(auto, undefined), 'not-started');
  assert.equal(taskStatus(auto, blank), 'not-started');
  assert.equal(taskStatus(auto, tried), 'in-progress');
  assert.equal(taskStatus(auto, passed), 'complete');
  assert.equal(taskStatus(mentor, passed), 'needs-review');
  assert.equal(taskStatus(mentor, tried), 'in-progress');
  assert.equal(taskStatus(auto, { ...passed, mentor: 'needs-work' }), 'needs-review');
  assert.equal(taskStatus(mentor, { ...blank, mentor: 'pass' }), 'complete');
});

test('nextTask walks modes in order and returns null when everything is complete', () => {
  const m = makeMission();
  let s = emptyState();
  assert.equal(nextTask(s, [m]).task.id, 'g1');
  s = recordAttempt(s, taskKey('m900', 'guided', 'g1'), 'x', { passed: true });
  assert.deepEqual([nextTask(s, [m]).mode, nextTask(s, [m]).task.id], ['independent', 'i1']);
  s = recordAttempt(s, taskKey('m900', 'independent', 'i1'), 'x', { passed: true });
  s = setMentorVerdict(s, taskKey('m900', 'incident', 'p1'), 'pass');
  assert.equal(nextTask(s, [m]), null);
});
