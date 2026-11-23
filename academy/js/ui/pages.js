// Revision plan, achievements and settings views.

import { h, notice, breadcrumb, statusBadge } from './dom.js';
import { href } from '../core/router.js';
import { MODE_LABELS, taskKey, taskStatus } from '../core/progress.js';
import { weakTopics, untouchedTopics, WEIGHTS } from '../core/weakTopics.js';
import { evaluateAchievements } from '../core/achievements.js';

/** Render the weak-topic revision plan. */
export function revisionView(app) {
  const { missions, topics, missionsById } = app.content;
  const state = app.store.getState();
  const weak = weakTopics(state, missions);
  const untouched = untouchedTopics(state, missions);

  const node = h('div', { class: 'stack' },
    breadcrumb([['Dashboard', href.dashboard()], ['Revision plan', href.revision()]]),
    h('h1', {}, 'Weak topics and revision plan'),
    h('p', {}, 'Ranked from what you actually did: hints opened, failed attempts, solutions revealed before solving, mentor "needs work" verdicts and quiz questions missed on the first try.'),
    weak.length === 0
      ? notice('info', 'No weak topics yet. Work some tasks and the quiz; this page fills in as you go.')
      : h('ol', { class: 'stack', role: 'list' }, weak.map((w, i) => {
        const topic = topics[w.topic];
        return h('li', { class: 'card' },
          h('div', { class: 'row spread' },
            h('h2', {}, `${i + 1}. ${topic.title}`),
            h('span', { class: 'score' }, `score ${w.score}`)),
          h('details', {}, h('summary', {}, `Why (${w.reasons.length} signal${w.reasons.length === 1 ? '' : 's'})`),
            h('ul', {}, w.reasons.map((r) => h('li', {}, r)))),
          h('h3', {}, 'Redo'),
          h('ul', {}, w.recommend.slice(0, 4).map((r) => {
            const task = missionsById[r.missionId].modes[r.mode].tasks.find((t) => t.id === r.taskId);
            return h('li', {},
              h('a', { href: href.task(r.missionId, r.mode, r.taskId) }, r.title),
              h('span', { class: 'muted' }, ` — ${r.missionId.toUpperCase()} ${MODE_LABELS[r.mode]} `),
              statusBadge(taskStatus(task, state.tasks[taskKey(r.missionId, r.mode, r.taskId)])));
          })),
          h('h3', {}, 'Read'),
          h('ul', {}, topic.docs.map((d) => h('li', {}, h('a', { href: d.url, rel: 'noopener noreferrer', target: '_blank' }, d.title, h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'))))),
        );
      })),
    untouched.length > 0 && h('section', { class: 'card', 'aria-labelledby': 'untouched-h' },
      h('h2', { id: 'untouched-h' }, 'Not practised yet'),
      h('ul', {}, untouched.map((t) => h('li', {}, topics[t].title)))),
    h('details', { class: 'card' }, h('summary', {}, 'How the score works'),
      h('ul', {},
        h('li', {}, `Quiz question wrong on the first try: +${WEIGHTS.quizWrongFirstTry}`),
        h('li', {}, `Solution revealed before solving: +${WEIGHTS.solutionBeforeComplete}`),
        h('li', {}, `Mentor said "needs work": +${WEIGHTS.mentorNeedsWork}`),
        h('li', {}, `Each hint opened: +${WEIGHTS.hintShown}`),
        h('li', {}, `Each failed attempt: +${WEIGHTS.failedAttempt} (at most ${WEIGHTS.failedAttemptCap} attempts per task count)`)),
      h('p', { class: 'muted small' }, 'Scores rank topics against each other. They are not a prediction of your exam result.')),
  );
  return { title: 'Revision plan', node };
}

/** Render all achievements, earned and locked. */
export function achievementsView(app) {
  const { missions, domains, missionsById } = app.content;
  const list = evaluateAchievements(app.store.getState(), { missions, domains, missionsById });
  const node = h('div', { class: 'stack' },
    breadcrumb([['Dashboard', href.dashboard()], ['Achievements', href.achievements()]]),
    h('h1', {}, 'Achievements'),
    h('p', {}, 'Earned only by completing work — they are recalculated from your progress every time, so they cannot drift out of sync with it.'),
    h('ul', { class: 'grid cards', role: 'list' }, list.map((a) => h('li', { class: `card achievement ${a.earned ? 'earned' : 'locked'}` },
      h('p', { class: 'ach-icon', 'aria-hidden': 'true' }, a.icon),
      h('h2', {}, a.title),
      h('p', { class: 'ach-state' }, a.earned ? 'Earned' : 'Locked'),
      h('p', { class: 'muted' }, a.criteria),
      a.detail && h('p', { class: 'small' }, a.detail),
    ))),
  );
  return { title: 'Achievements', node };
}

/** Render settings: storage status, export, import and reset. */
export function settingsView(app) {
  const status = h('p', { role: 'status', id: 'settings-status', tabindex: '-1' });
  const fileInput = h('input', { type: 'file', id: 'import-file', accept: 'application/json,.json' });

  const node = h('div', { class: 'stack' },
    breadcrumb([['Dashboard', href.dashboard()], ['Settings', href.settings()]]),
    h('h1', {}, 'Settings and your data'),
    h('section', { class: 'card', 'aria-labelledby': 'storage-h' },
      h('h2', { id: 'storage-h' }, 'Where progress is stored'),
      app.store.persistent
        ? h('p', {}, 'In this browser only (localStorage). It is not synced across browsers or devices, and clearing site data deletes it — export a backup now and then.')
        : notice('warn', app.store.warning),
      h('p', { class: 'muted small' }, 'Nothing leaves your machine. There is no server, no account and no analytics. The mentor prompt is copied to your clipboard only when you press the button.'),
    ),
    h('section', { class: 'card', 'aria-labelledby': 'backup-h' },
      h('h2', { id: 'backup-h' }, 'Backup'),
      h('div', { class: 'row' },
        h('button', {
          type: 'button',
          onClick: () => {
            const blob = new Blob([app.store.exportJson()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: `azure-academy-progress-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            status.textContent = 'Progress exported.';
          },
        }, 'Export progress (JSON)'),
      ),
      h('label', { for: 'import-file' }, 'Import a progress file (replaces current progress)'),
      fileInput,
      h('div', { class: 'row' },
        h('button', {
          type: 'button',
          onClick: async () => {
            const file = fileInput.files?.[0];
            if (!file) {
              status.textContent = 'Choose a file to import first.';
              return;
            }
            const err = app.store.importJson(await file.text());
            status.textContent = err ?? 'Progress imported.';
            if (!err) app.rerender({ focusId: 'settings-status' });
          },
        }, 'Import'),
      ),
    ),
    h('section', { class: 'card', 'aria-labelledby': 'reset-h' },
      h('h2', { id: 'reset-h', tabindex: '-1' }, 'Reset'),
      h('p', {}, 'Deletes all progress in this browser. Export first if you might want it back.'),
      h('button', {
        type: 'button', class: 'danger',
        onClick: () => {
          // The native confirm dialog is keyboard- and screen-reader-accessible, which is enough for a local reset.
          if (!window.confirm('Delete all progress in this browser?')) return;
          app.store.reset();
          app.announce('Progress reset.');
          app.rerender({ focusId: 'reset-h' });
        },
      }, 'Reset all progress'),
    ),
    status,
  );
  return { title: 'Settings', node };
}
