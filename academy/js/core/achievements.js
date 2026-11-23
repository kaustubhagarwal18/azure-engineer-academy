// Achievements are *derived* from progress every time — never stored as flags — so they can only
// be earned by genuinely completing tasks, and they disappear again if progress is reset.

import { isTaskComplete, missionTasks, modeProgress, quizProgress, missionFraction } from './progress.js';

/** Every completed task across all missions, as [{ mission, mode, task, record }]. */
function completedTasks(state, missions) {
  return missions.flatMap((mission) =>
    missionTasks(mission)
      .map(({ mode, task, key }) => ({ mission, mode, task, record: state.tasks[key] }))
      .filter(({ task, record }) => isTaskComplete(task, record)),
  );
}

/** True when at least one mission has every task in the given mode complete. */
function anyModeComplete(state, missions, mode) {
  return missions.some((m) => {
    const p = modeProgress(state, m, mode);
    return p.total > 0 && p.done === p.total;
  });
}

/**
 * The achievement catalogue. Each entry has id, icon, title, criteria (shown while locked) and
 * progress(state, ctx) -> { earned, detail }. ctx = { missions, domains, missionsById }.
 */
export const ACHIEVEMENTS = [
  {
    id: 'first-solve', icon: '🔑', title: 'First solve',
    criteria: 'Complete any task.',
    progress: (s, { missions }) => {
      const n = completedTasks(s, missions).length;
      return { earned: n >= 1, detail: `${Math.min(n, 1)} / 1 task` };
    },
  },
  {
    id: 'unassisted', icon: '🧠', title: 'Unassisted',
    criteria: 'Complete 3 tasks without opening a hint or revealing the solution first.',
    progress: (s, { missions }) => {
      const n = completedTasks(s, missions)
        .filter(({ record }) => record.hintsShown === 0 && !record.solutionBeforeComplete).length;
      return { earned: n >= 3, detail: `${Math.min(n, 3)} / 3 tasks` };
    },
  },
  {
    id: 'guided-graduate', icon: '🧭', title: 'Guided graduate',
    criteria: 'Complete every task in one mission\'s Guided mode.',
    progress: (s, { missions }) => ({ earned: anyModeComplete(s, missions, 'guided'), detail: '' }),
  },
  {
    id: 'independent-operator', icon: '🛠️', title: 'Independent operator',
    criteria: 'Complete every task in one mission\'s Independent mode.',
    progress: (s, { missions }) => ({ earned: anyModeComplete(s, missions, 'independent'), detail: '' }),
  },
  {
    id: 'incident-responder', icon: '🚑', title: 'Incident responder',
    criteria: 'Resolve 3 Production Incident tasks (mentor-reviewed).',
    progress: (s, { missions }) => {
      const n = completedTasks(s, missions).filter(({ mode }) => mode === 'incident').length;
      return { earned: n >= 3, detail: `${Math.min(n, 3)} / 3 incidents` };
    },
  },
  {
    id: 'mentor-approved', icon: '🤝', title: 'Mentor approved',
    criteria: 'Get a mentor PASS on 5 tasks.',
    progress: (s, { missions }) => {
      const n = completedTasks(s, missions).filter(({ record }) => record.mentor === 'pass').length;
      return { earned: n >= 5, detail: `${Math.min(n, 5)} / 5 reviews` };
    },
  },
  {
    id: 'quiz-ace', icon: '🎯', title: 'Quiz ace',
    criteria: 'Answer every question in one mission\'s quiz correctly on the first try.',
    progress: (s, { missions }) => ({
      earned: missions.some((m) => {
        const q = quizProgress(s, m);
        return q.total > 0 && q.correctFirstTry === q.total;
      }),
      detail: '',
    }),
  },
  {
    id: 'mission-complete', icon: '🏁', title: 'Mission complete',
    criteria: 'Finish all three modes and the quiz of any mission.',
    progress: (s, { missions }) => ({ earned: missions.some((m) => missionFraction(s, m) === 1), detail: '' }),
  },
  {
    id: 'domain-specialist', icon: '🛡️', title: 'Domain specialist',
    criteria: 'Complete every planned mission in one AZ-104 domain (needs that domain\'s missions to be published).',
    progress: (s, { domains, missionsById }) => ({
      earned: domains.some((d) =>
        d.missions.length > 0 &&
        d.missions.every((m) => missionsById[m.id] && missionFraction(s, missionsById[m.id]) === 1)),
      detail: '',
    }),
  },
];

/** Evaluate every achievement: [{ id, icon, title, criteria, earned, detail }]. */
export function evaluateAchievements(state, ctx) {
  return ACHIEVEMENTS.map(({ progress, ...meta }) => ({ ...meta, ...progress(state, ctx) }));
}
