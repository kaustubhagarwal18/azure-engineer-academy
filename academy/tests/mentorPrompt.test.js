// Tests for the mentor review prompt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMentorPrompt } from '../js/core/mentorPrompt.js';
import { evaluate } from '../js/core/evaluate.js';
import { loadContent } from '../js/core/content.js';
import { fetchFromDisk } from './helpers.js';

const c = await loadContent(fetchFromDisk);
const mission = c.missionsById.m001;
const task = mission.modes.guided.tasks.find((t) => t.id === 'g4-role-assignment');

test('includes the scenario, challenge, answer, check results and hint count', () => {
  const answer = 'az role assignment create --assignee x --role Owner';
  const prompt = buildMentorPrompt({ mission, mode: 'guided', task, answer, evaluation: evaluate(answer, task.checks), hintsShown: 2 });
  assert.ok(prompt.includes(task.scenario));
  assert.ok(prompt.includes(task.challenge));
  assert.ok(prompt.includes(answer));
  assert.match(prompt, /\[FAIL\] Does not use Owner or Contributor/);
  assert.match(prompt, /Hints I used: 2 of 3\./);
  assert.match(prompt, /Mode: Guided/);
  assert.match(prompt, /Verdict: PASS" or "Verdict: NEEDS WORK"/);
  assert.match(prompt, /```sh\n/);
});

test('never leaks the reference solution', () => {
  for (const mode of ['guided', 'independent', 'incident']) {
    for (const t of mission.modes[mode].tasks) {
      const prompt = buildMentorPrompt({ mission, mode, task: t, answer: 'my try', evaluation: null, hintsShown: 0 });
      assert.ok(!prompt.includes(t.solution.code), `${t.id} leaks its solution`);
      assert.ok(!prompt.includes(t.solution.explanation), `${t.id} leaks its explanation`);
    }
  }
});

test('says so when the answer was not submitted or is empty', () => {
  const prompt = buildMentorPrompt({ mission, mode: 'guided', task, answer: '  ', evaluation: null, hintsShown: 0 });
  assert.match(prompt, /\(empty\)/);
  assert.match(prompt, /not run: I have not submitted/);
});
