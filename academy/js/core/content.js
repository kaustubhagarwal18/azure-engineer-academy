// Loading and validating course content (academy/content/*.json). Validation is strict and
// returns every problem at once, so a content mistake is caught by the tests and CI rather than
// surfacing as a blank screen.

import { MODES } from './progress.js';
import { compileCheck } from './evaluate.js';

const ANSWER_TYPES = ['cli', 'bicep', 'json', 'text'];
const REVIEW_TYPES = ['auto', 'mentor'];

/** Collect a problem when a condition is false. */
function need(problems, ok, message) {
  if (!ok) problems.push(message);
}

/** Non-empty string check. */
function str(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** Validate the topic catalogue; returns a list of problems (empty when valid). */
export function validateTopics(topics) {
  const problems = [];
  need(problems, topics && typeof topics === 'object' && !Array.isArray(topics), 'topics.json must be an object keyed by topic id');
  for (const [id, t] of Object.entries(topics ?? {})) {
    need(problems, str(t.title), `topic ${id}: missing title`);
    need(problems, Array.isArray(t.docs) && t.docs.length > 0, `topic ${id}: needs at least one docs link`);
    for (const d of t.docs ?? []) {
      need(problems, str(d.title) && /^https:\/\/learn\.microsoft\.com\//.test(d.url ?? ''), `topic ${id}: docs links must be titled https://learn.microsoft.com/ URLs`);
    }
  }
  return problems;
}

/** Validate the domain list; returns a list of problems (empty when valid). */
export function validateDomains(domains) {
  const problems = [];
  need(problems, Array.isArray(domains) && domains.length === 5, 'domains.json must list the 5 AZ-104 domains');
  const missionIds = new Set();
  for (const d of domains ?? []) {
    need(problems, str(d.id) && str(d.title), `domain ${d.id}: needs id and title`);
    need(problems, Array.isArray(d.weight) && d.weight.length === 2 && d.weight[0] <= d.weight[1], `domain ${d.id}: weight must be [min, max]`);
    need(problems, Array.isArray(d.missions), `domain ${d.id}: missions must be a list`);
    for (const m of d.missions ?? []) {
      need(problems, str(m.id) && str(m.title), `domain ${d.id}: every mission needs id and title`);
      need(problems, !missionIds.has(m.id), `mission id ${m.id} is listed twice`);
      missionIds.add(m.id);
    }
  }
  return problems;
}

/** Validate one mission against the domains and topics; returns a list of problems. */
export function validateMission(mission, topics) {
  const p = [];
  const where = `mission ${mission?.id ?? '?'}`;
  need(p, str(mission?.id) && str(mission?.title) && str(mission?.domain), `${where}: needs id, title and domain`);
  need(p, mission?.modes && typeof mission.modes === 'object', `${where}: needs modes`);
  for (const mode of MODES) {
    const m = mission?.modes?.[mode];
    need(p, m && str(m.intro) && Array.isArray(m.tasks) && m.tasks.length > 0, `${where}: mode ${mode} needs an intro and at least one task`);
    const ids = new Set();
    for (const t of m?.tasks ?? []) {
      const tw = `${where} ${mode}/${t.id}`;
      need(p, str(t.id) && !ids.has(t.id), `${tw}: task ids must be present and unique within a mode`);
      ids.add(t.id);
      for (const field of ['title', 'scenario', 'challenge']) need(p, str(t[field]), `${tw}: missing ${field}`);
      need(p, ANSWER_TYPES.includes(t.answerType), `${tw}: answerType must be one of ${ANSWER_TYPES.join(', ')}`);
      need(p, REVIEW_TYPES.includes(t.review), `${tw}: review must be one of ${REVIEW_TYPES.join(', ')}`);
      need(p, Array.isArray(t.hints) && t.hints.length > 0 && t.hints.every(str), `${tw}: needs at least one hint`);
      need(p, Array.isArray(t.topics) && t.topics.length > 0, `${tw}: needs at least one topic`);
      for (const topic of t.topics ?? []) need(p, topics[topic], `${tw}: unknown topic "${topic}"`);
      need(p, t.solution && str(t.solution.code) && str(t.solution.explanation), `${tw}: solution needs code and explanation`);
      need(p, Array.isArray(t.checks) && t.checks.length > 0, `${tw}: needs at least one check`);
      need(p, (t.checks ?? []).some((c) => c.kind === 'require'), `${tw}: needs at least one "require" check`);
      const checkIds = new Set();
      for (const c of t.checks ?? []) {
        need(p, str(c.id) && !checkIds.has(c.id), `${tw}: check ids must be present and unique`);
        checkIds.add(c.id);
        need(p, c.kind === 'require' || c.kind === 'forbid', `${tw}/${c.id}: kind must be require or forbid`);
        need(p, str(c.description) && str(c.mistake), `${tw}/${c.id}: needs description and mistake`);
        try {
          compileCheck(c);
        } catch (e) {
          p.push(`${tw}/${c.id}: invalid pattern (${e.message})`);
        }
      }
    }
  }
  need(p, Array.isArray(mission?.quiz) && mission.quiz.length > 0, `${where}: needs a quiz`);
  const qids = new Set();
  for (const q of mission?.quiz ?? []) {
    const qw = `${where} quiz/${q.id}`;
    need(p, str(q.id) && !qids.has(q.id), `${qw}: quiz ids must be present and unique`);
    qids.add(q.id);
    need(p, str(q.prompt), `${qw}: missing prompt`);
    need(p, Array.isArray(q.options) && q.options.length >= 2 && q.options.every(str), `${qw}: needs at least 2 options`);
    need(p, Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.options?.length ?? 0), `${qw}: answer must index an option`);
    need(p, str(q.explanation), `${qw}: missing explanation`);
    need(p, Array.isArray(q.topics) && q.topics.length > 0, `${qw}: needs at least one topic`);
    for (const topic of q.topics ?? []) need(p, topics[topic], `${qw}: unknown topic "${topic}"`);
    if (q.optionFeedback !== undefined) {
      need(p, Array.isArray(q.optionFeedback) && q.optionFeedback.length === q.options?.length, `${qw}: optionFeedback must have one entry per option`);
    }
  }
  return p;
}

/**
 * Load all content with an injected fetchJson(path) and validate it.
 * Returns { domains, topics, missions, missionsById }; throws one Error listing every problem.
 */
export async function loadContent(fetchJson) {
  const [domains, topics] = await Promise.all([fetchJson('content/domains.json'), fetchJson('content/topics.json')]);
  const problems = [...validateDomains(domains), ...validateTopics(topics)];
  const available = domains.flatMap((d) => d.missions.filter((m) => m.available).map((m) => ({ ...m, domain: d.id })));
  const missions = await Promise.all(available.map((m) => fetchJson(`content/missions/${m.id}.json`)));
  for (const [i, mission] of missions.entries()) {
    problems.push(...validateMission(mission, topics));
    if (mission.id !== available[i].id) problems.push(`content/missions/${available[i].id}.json has id ${mission.id}`);
    if (mission.domain !== available[i].domain) problems.push(`mission ${mission.id}: domain ${mission.domain} does not match domains.json (${available[i].domain})`);
  }
  if (problems.length > 0) throw new Error(`Content is invalid:\n- ${problems.join('\n- ')}`);
  const missionsById = Object.fromEntries(missions.map((m) => [m.id, m]));
  return { domains, topics, missions, missionsById };
}
