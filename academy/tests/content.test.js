// Content integrity: the shipped JSON is valid, and every task's reference solution passes its
// own checks. If a solution fails its checks, the checks are wrong — not the learner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, validateMission, validateDomains, validateTopics } from '../js/core/content.js';
import { evaluate } from '../js/core/evaluate.js';
import { missionTasks } from '../js/core/progress.js';
import { fetchFromDisk, readJson, makeMission, makeTask } from './helpers.js';

const content = await loadContent(fetchFromDisk);
const topics = readJson('content/topics.json');

test('shipped content loads and validates with no problems', () => {
  assert.equal(content.domains.length, 5);
  assert.ok(content.missions.length >= 1);
});

test('domain exam weights match the AZ-104 study guide ranges in ROADMAP.md', () => {
  const weights = Object.fromEntries(content.domains.map((d) => [d.id, d.weight]));
  assert.deepEqual(weights, {
    'identity-governance': [20, 25], storage: [15, 20], compute: [20, 25], networking: [15, 20], monitoring: [10, 15],
  });
});

for (const mission of content.missions) {
  for (const { mode, task } of missionTasks(mission)) {
    test(`${mission.id} ${mode}/${task.id}: reference solution passes every check`, () => {
      const result = evaluate(task.solution.code, task.checks);
      const failing = result.results.filter((r) => !r.passed).map((r) => r.id);
      assert.deepEqual(failing, [], `solution fails checks: ${failing.join(', ')}`);
    });

    test(`${mission.id} ${mode}/${task.id}: an empty answer fails`, () => {
      assert.equal(evaluate('', task.checks).passed, false);
      assert.equal(evaluate('   \n  ', task.checks).passed, false);
    });

    test(`${mission.id} ${mode}/${task.id}: an unrelated answer fails`, () => {
      assert.equal(evaluate('I am not sure, please help', task.checks).passed, false);
    });
  }
}

test('validator reports every class of broken mission content', async (t) => {
  const cases = {
    'unknown topic': (m) => { m.modes.guided.tasks[0].topics = ['nope']; },
    'invalid regex': (m) => { m.modes.guided.tasks[0].checks[0].pattern = '(unclosed'; },
    'no require check': (m) => { m.modes.guided.tasks[0].checks = [{ id: 'f', kind: 'forbid', pattern: 'x', description: 'd', mistake: 'm' }]; },
    'bad check kind': (m) => { m.modes.guided.tasks[0].checks[0].kind = 'maybe'; },
    'bad answerType': (m) => { m.modes.guided.tasks[0].answerType = 'yaml'; },
    'bad review': (m) => { m.modes.guided.tasks[0].review = 'peer'; },
    'no hints': (m) => { m.modes.guided.tasks[0].hints = []; },
    'no solution': (m) => { delete m.modes.guided.tasks[0].solution; },
    'missing mode': (m) => { delete m.modes.incident; },
    'duplicate task id': (m) => { m.modes.guided.tasks.push(makeTask({ id: 'g1' })); },
    'quiz answer out of range': (m) => { m.quiz[0].answer = 2; },
    'quiz answer not integer': (m) => { m.quiz[0].answer = '0'; },
    'optionFeedback length': (m) => { m.quiz[0].optionFeedback = ['only one']; },
    'empty quiz': (m) => { m.quiz = []; },
  };
  assert.deepEqual(validateMission(makeMission(), topics), [], 'the fixture itself must be valid');
  for (const [name, breakIt] of Object.entries(cases)) {
    await t.test(name, () => {
      const m = structuredClone(makeMission());
      breakIt(m);
      assert.ok(validateMission(m, topics).length > 0, `expected a problem for: ${name}`);
    });
  }
});

test('validator rejects domain lists that are not the 5 AZ-104 domains or repeat a mission', () => {
  const domains = readJson('content/domains.json');
  assert.deepEqual(validateDomains(domains), []);
  assert.ok(validateDomains(domains.slice(0, 4)).length > 0);
  const dup = structuredClone(domains);
  dup[1].missions.push({ id: 'm001', title: 'dup' });
  assert.ok(validateDomains(dup).some((p) => p.includes('m001')));
  const badWeight = structuredClone(domains);
  badWeight[0].weight = [25, 20];
  assert.ok(validateDomains(badWeight).length > 0);
});

test('validator only accepts titled Microsoft Learn links for topics', () => {
  assert.deepEqual(validateTopics(topics), []);
  assert.ok(validateTopics({ x: { title: 'X', docs: [{ title: 'bad', url: 'http://example.com' }] } }).length > 0);
  assert.ok(validateTopics({ x: { title: 'X', docs: [] } }).length > 0);
});

test('loadContent throws one error listing every problem', async () => {
  const broken = async (path) => {
    const data = await fetchFromDisk(path);
    if (path.endsWith('m001.json')) {
      data.modes.guided.tasks[0].topics = ['nope'];
      data.quiz[0].answer = 99;
    }
    return data;
  };
  await assert.rejects(loadContent(broken), (err) => {
    assert.match(err.message, /unknown topic "nope"/);
    assert.match(err.message, /answer must index an option/);
    return true;
  });
});
