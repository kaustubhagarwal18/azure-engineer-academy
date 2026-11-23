// Weak-topic analysis. Every task and quiz question is tagged with topics; struggle signals add
// weight to those topics. The scores rank what to revise — they are not an exam-readiness score.

import { missionTasks, isTaskComplete, quizKey } from './progress.js';

/** How much each struggle signal counts. Exported so the UI can explain the scoring. */
export const WEIGHTS = {
  quizWrongFirstTry: 2,
  solutionBeforeComplete: 2,
  mentorNeedsWork: 2,
  hintShown: 0.5,
  failedAttempt: 0.5,
  failedAttemptCap: 4,
};

/**
 * Score topics from progress. Returns [{ topic, score, reasons[], recommend[] }] for topics with a
 * score above zero, highest first, where recommend lists tasks to redo:
 * [{ missionId, mode, taskId, title, complete }] (incomplete tasks first).
 */
export function weakTopics(state, missions) {
  const byTopic = new Map();
  const entry = (topic) => {
    if (!byTopic.has(topic)) byTopic.set(topic, { topic, score: 0, reasons: [], recommend: [] });
    return byTopic.get(topic);
  };

  for (const mission of missions) {
    for (const { mode, task, key } of missionTasks(mission)) {
      const r = state.tasks[key];
      const complete = isTaskComplete(task, r);
      for (const topic of task.topics) {
        entry(topic).recommend.push({ missionId: mission.id, mode, taskId: task.id, title: task.title, complete });
      }
      if (!r) continue;
      let score = 0;
      const reasons = [];
      if (r.hintsShown > 0) {
        score += r.hintsShown * WEIGHTS.hintShown;
        reasons.push(`${r.hintsShown} hint(s) on "${task.title}"`);
      }
      if (r.failedAttempts > 0) {
        score += Math.min(r.failedAttempts * WEIGHTS.failedAttempt, WEIGHTS.failedAttemptCap * WEIGHTS.failedAttempt);
        reasons.push(`${r.failedAttempts} failed attempt(s) on "${task.title}"`);
      }
      if (r.solutionBeforeComplete) {
        score += WEIGHTS.solutionBeforeComplete;
        reasons.push(`solution revealed before solving "${task.title}"`);
      }
      if (r.mentor === 'needs-work') {
        score += WEIGHTS.mentorNeedsWork;
        reasons.push(`mentor said "needs work" on "${task.title}"`);
      }
      for (const topic of task.topics) {
        const e = entry(topic);
        e.score += score;
        e.reasons.push(...reasons);
      }
    }
    for (const q of mission.quiz ?? []) {
      const r = state.quiz[quizKey(mission.id, q.id)];
      if (!r || r.firstTryCorrect) continue;
      for (const topic of q.topics) {
        const e = entry(topic);
        e.score += WEIGHTS.quizWrongFirstTry;
        e.reasons.push(`quiz question missed first time: "${q.prompt.slice(0, 60)}${q.prompt.length > 60 ? '…' : ''}"`);
      }
    }
  }

  return [...byTopic.values()]
    .filter((e) => e.score > 0)
    .map((e) => ({ ...e, recommend: [...e.recommend].sort((a, b) => Number(a.complete) - Number(b.complete)) }))
    .sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));
}

/** Topics that appear in the content but that the learner has not practised at all yet. */
export function untouchedTopics(state, missions) {
  const seen = new Set();
  const all = new Set();
  for (const mission of missions) {
    for (const { task, key } of missionTasks(mission)) {
      task.topics.forEach((t) => all.add(t));
      if (state.tasks[key]?.attempts > 0) task.topics.forEach((t) => seen.add(t));
    }
    for (const q of mission.quiz ?? []) {
      q.topics.forEach((t) => all.add(t));
      if (state.quiz[quizKey(mission.id, q.id)]) q.topics.forEach((t) => seen.add(t));
    }
  }
  return [...all].filter((t) => !seen.has(t)).sort();
}
