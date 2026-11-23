// Progress rules: how learner actions change state, and what counts as "complete".
// All functions are pure: they return a new state and never mutate the one passed in.

export const MODES = ['guided', 'independent', 'incident'];
export const MODE_LABELS = { guided: 'Guided', independent: 'Independent', incident: 'Production Incident' };

/** Stable key for a task's progress record. */
export function taskKey(missionId, mode, taskId) {
  return `${missionId}/${mode}/${taskId}`;
}

/** Stable key for a quiz question's progress record. */
export function quizKey(missionId, questionId) {
  return `${missionId}/${questionId}`;
}

/** A task's record, or a blank one when the learner has not touched it. */
export function taskRecord(state, key) {
  return state.tasks[key] ?? {
    attempts: 0, failedAttempts: 0, lastAnswer: '', autoPassed: false,
    hintsShown: 0, solutionRevealed: false, solutionBeforeComplete: false,
    mentor: null, mentorNotes: '',
  };
}

/** Return a copy of state with one task record replaced. */
function withTask(state, key, record) {
  return { ...state, tasks: { ...state.tasks, [key]: record } };
}

/**
 * Whether a task is complete. A mentor verdict is the stronger signal and wins either way:
 * "pass" completes the task even if the rule checks failed, and "needs-work" un-completes an
 * auto-pass. Tasks marked review: "mentor" (open-ended incident write-ups) need a mentor pass.
 */
export function isTaskComplete(task, record) {
  if (!record) return false;
  if (record.mentor === 'pass') return true;
  if (task.review === 'mentor') return false;
  return record.autoPassed && record.mentor !== 'needs-work';
}

/**
 * A task's status for display:
 *   'complete'     done (see isTaskComplete);
 *   'needs-review' the rule checks passed but a mentor verdict is still needed, or the mentor said needs work;
 *   'in-progress'  attempted but not passed;
 *   'not-started'  never attempted.
 */
export function taskStatus(task, record) {
  if (isTaskComplete(task, record)) return 'complete';
  if (!record || record.attempts === 0) return record?.mentor === 'needs-work' ? 'needs-review' : 'not-started';
  if (record.mentor === 'needs-work' || (task.review === 'mentor' && record.autoPassed)) return 'needs-review';
  return 'in-progress';
}

/** The first incomplete task across missions, in mission and mode order, or null when all are done. */
export function nextTask(state, missions) {
  for (const mission of missions) {
    for (const { mode, task, key } of missionTasks(mission)) {
      if (!isTaskComplete(task, state.tasks[key])) return { mission, mode, task };
    }
  }
  return null;
}

/** Record a submitted answer and the outcome of its rule checks. */
export function recordAttempt(state, key, answer, evaluation) {
  const r = taskRecord(state, key);
  return withTask(state, key, {
    ...r,
    attempts: r.attempts + 1,
    failedAttempts: r.failedAttempts + (evaluation.passed ? 0 : 1),
    lastAnswer: answer,
    autoPassed: r.autoPassed || evaluation.passed,
  });
}

/** Reveal the next hint, up to the number of hints the task has. */
export function showNextHint(state, key, totalHints) {
  const r = taskRecord(state, key);
  return withTask(state, key, { ...r, hintsShown: Math.min(r.hintsShown + 1, totalHints) });
}

/** Whether the solution may be revealed: only after at least one submitted attempt. */
export function canRevealSolution(record) {
  return record.attempts > 0;
}

/** Reveal the solution; remembers whether that happened before the task was complete. */
export function revealSolution(state, key, task) {
  const r = taskRecord(state, key);
  if (!canRevealSolution(r) || r.solutionRevealed) return state;
  return withTask(state, key, {
    ...r,
    solutionRevealed: true,
    solutionBeforeComplete: !isTaskComplete(task, r),
  });
}

/** Record the mentor's verdict ('pass' | 'needs-work' | null to clear) and optional notes. */
export function setMentorVerdict(state, key, verdict, notes = '') {
  const r = taskRecord(state, key);
  return withTask(state, key, { ...r, mentor: verdict, mentorNotes: notes });
}

/** Record a quiz answer. Only the first answer decides "correct first try". */
export function answerQuiz(state, key, choice, correct) {
  const prev = state.quiz[key];
  const record = {
    attempts: (prev?.attempts ?? 0) + 1,
    firstTryCorrect: prev ? prev.firstTryCorrect : correct,
    lastChoice: choice,
    correct,
  };
  return { ...state, quiz: { ...state.quiz, [key]: record } };
}

/** All tasks of a mission as [{ mode, task, key }], in mode order. */
export function missionTasks(mission) {
  return MODES.flatMap((mode) =>
    (mission.modes[mode]?.tasks ?? []).map((task) => ({ mode, task, key: taskKey(mission.id, mode, task.id) })),
  );
}

/** { done, total } for one mode of a mission. */
export function modeProgress(state, mission, mode) {
  const tasks = mission.modes[mode]?.tasks ?? [];
  const done = tasks.filter((t) => isTaskComplete(t, state.tasks[taskKey(mission.id, mode, t.id)])).length;
  return { done, total: tasks.length };
}

/** { done, total, correctFirstTry, answered } for a mission's quiz. */
export function quizProgress(state, mission) {
  const qs = mission.quiz ?? [];
  const recs = qs.map((q) => state.quiz[quizKey(mission.id, q.id)]);
  return {
    total: qs.length,
    answered: recs.filter(Boolean).length,
    done: recs.filter((r) => r?.correct).length,
    correctFirstTry: recs.filter((r) => r?.firstTryCorrect).length,
  };
}

/**
 * A mission's completion as a fraction 0..1. Tasks and quiz questions count equally, so a mission
 * is only "done" when every task is complete and every question has been answered correctly.
 */
export function missionFraction(state, mission) {
  const tasks = missionTasks(mission);
  const done = tasks.filter(({ task, key }) => isTaskComplete(task, state.tasks[key])).length;
  const quiz = quizProgress(state, mission);
  const total = tasks.length + quiz.total;
  return total === 0 ? 0 : (done + quiz.done) / total;
}

/**
 * Progress for one domain: the mean of its planned missions' fractions. Missions without content
 * yet count as 0, so a domain is never shown as complete just because little content exists.
 */
export function domainFraction(state, domain, missionsById) {
  if (domain.missions.length === 0) return 0;
  const sum = domain.missions.reduce((acc, m) => {
    const mission = missionsById[m.id];
    return acc + (mission ? missionFraction(state, mission) : 0);
  }, 0);
  return sum / domain.missions.length;
}

/** Midpoint of a domain's exam weight range, e.g. [20, 25] -> 22.5. */
export function weightMidpoint(domain) {
  return (domain.weight[0] + domain.weight[1]) / 2;
}

/** Overall AZ-104 progress 0..1, with each domain weighted by the midpoint of its exam weight. */
export function overallFraction(state, domains, missionsById) {
  const totalWeight = domains.reduce((a, d) => a + weightMidpoint(d), 0);
  if (totalWeight === 0) return 0;
  return domains.reduce((a, d) => a + weightMidpoint(d) * domainFraction(state, d, missionsById), 0) / totalWeight;
}
