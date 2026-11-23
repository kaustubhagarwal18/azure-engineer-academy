// Domain and mission overview views.

import { h, meter, rich, statusBadge, breadcrumb, missionCrumbs } from './dom.js';
import { href } from '../core/router.js';
import {
  MODES, MODE_LABELS, domainFraction, missionFraction, modeProgress, quizProgress, taskKey, taskStatus,
} from '../core/progress.js';

/** Render a domain: its skills and missions (published and planned). */
export function domainView(app, { domainId }) {
  const domain = app.content.domains.find((d) => d.id === domainId);
  if (!domain) return null;
  const state = app.store.getState();
  const node = h('div', { class: 'stack' },
    breadcrumb([['Dashboard', href.dashboard()], [domain.title, href.domain(domain.id)]]),
    h('h1', {}, domain.title),
    h('p', { class: 'eyebrow' }, `Week ${domain.week} · ${domain.weight[0]}–${domain.weight[1]}% of the AZ-104 exam`),
    meter(domainFraction(state, domain, app.content.missionsById), 'Domain progress'),
    h('h2', {}, 'Skills measured'),
    h('ul', {}, domain.skills.map((s) => h('li', {}, s))),
    h('h2', {}, 'Missions'),
    h('ul', { class: 'stack', role: 'list' }, domain.missions.map((m) => {
      const mission = app.content.missionsById[m.id];
      return h('li', { class: 'card' },
        h('h3', {}, mission ? h('a', { href: href.mission(m.id) }, `${m.id.toUpperCase()} — ${m.title}`) : `${m.id.toUpperCase()} — ${m.title}`),
        mission
          ? meter(missionFraction(state, mission), 'Mission progress')
          : h('p', { class: 'muted' }, 'Planned — not published yet. See ROADMAP.md.'),
      );
    })),
  );
  return { title: domain.title, node };
}

/** Render a mission: summary, the three modes with their task lists, and the quiz. */
export function missionView(app, { missionId }) {
  const mission = app.content.missionsById[missionId];
  if (!mission) return null;
  const state = app.store.getState();
  const quiz = quizProgress(state, mission);

  const node = h('div', { class: 'stack' },
    missionCrumbs(app, mission),
    h('h1', {}, `${mission.id.toUpperCase()} — ${mission.title}`),
    rich(mission.summary),
    h('p', { class: 'muted' }, `About ${mission.estimatedMinutes} minutes per mode. Full write-up, architecture and reference CLI/Bicep: `,
      h('a', { href: mission.readme }, 'mission README')),
    meter(missionFraction(state, mission), 'Mission progress'),

    MODES.map((mode) => {
      const m = mission.modes[mode];
      const p = modeProgress(state, mission, mode);
      return h('section', { class: 'card', 'aria-labelledby': `mode-${mode}` },
        h('div', { class: 'row spread' },
          h('h2', { id: `mode-${mode}` }, MODE_LABELS[mode]),
          h('span', { class: 'muted' }, `${p.done} / ${p.total} complete`)),
        rich(m.intro),
        h('ol', { class: 'task-list' }, m.tasks.map((t) => h('li', {},
          h('a', { href: href.task(mission.id, mode, t.id) }, t.title),
          ' ', statusBadge(taskStatus(t, state.tasks[taskKey(mission.id, mode, t.id)])),
        ))),
      );
    }),

    h('section', { class: 'card', 'aria-labelledby': 'quiz-h' },
      h('div', { class: 'row spread' },
        h('h2', { id: 'quiz-h' }, 'Exam-style quiz'),
        h('span', { class: 'muted' }, `${quiz.done} / ${quiz.total} correct`)),
      h('p', {}, `${quiz.total} AZ-104-style questions with feedback on every option.`),
      h('a', { class: 'button', href: href.quiz(mission.id) }, quiz.answered > 0 ? 'Continue quiz' : 'Start quiz'),
    ),
  );
  return { title: `${mission.id.toUpperCase()} ${mission.title}`, node };
}
