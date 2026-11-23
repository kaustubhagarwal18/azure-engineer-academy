// Dashboard: overall AZ-104 progress, the next task, the five domains, weak topics and achievements.

import { h, meter, notice } from './dom.js';
import { href } from '../core/router.js';
import { overallFraction, domainFraction, nextTask, MODE_LABELS, weightMidpoint } from '../core/progress.js';
import { weakTopics } from '../core/weakTopics.js';
import { evaluateAchievements } from '../core/achievements.js';

/** Render the dashboard view. */
export function dashboardView(app) {
  const { domains, missions, missionsById, topics } = app.content;
  const state = app.store.getState();
  const overall = overallFraction(state, domains, missionsById);
  const planned = domains.reduce((n, d) => n + d.missions.length, 0);
  const published = missions.length;
  const next = nextTask(state, missions);
  const weak = weakTopics(state, missions).slice(0, 3);
  const achievements = evaluateAchievements(state, { missions, domains, missionsById });
  const earned = achievements.filter((a) => a.earned);

  const node = h('div', { class: 'stack' },
    h('h1', {}, 'AZ-104 progress'),
    h('section', { class: 'card hero', 'aria-label': 'Overall progress' },
      meter(overall, 'Overall AZ-104 progress', { size: 'meter-lg' }),
      h('p', { class: 'muted' },
        `Weighted by each domain's exam weight. Content published so far: ${published} of ${planned} planned missions, `,
        'so this number grows as missions are added. It measures coverage, not exam readiness.'),
    ),

    h('section', { class: 'card', 'aria-labelledby': 'next-h' },
      h('h2', { id: 'next-h' }, 'Continue'),
      next
        ? [
          h('p', {}, h('strong', {}, next.task.title), ` — ${next.mission.id.toUpperCase()}, ${MODE_LABELS[next.mode]} mode`),
          h('a', { class: 'button primary', href: href.task(next.mission.id, next.mode, next.task.id) }, 'Open task'),
        ]
        : h('p', {}, 'Every published task is complete. Review weak topics or retake a quiz while the next mission is written.'),
    ),

    h('section', { 'aria-labelledby': 'domains-h' },
      h('h2', { id: 'domains-h' }, 'Domains'),
      h('ul', { class: 'grid cards', role: 'list' }, domains.map((d) => {
        const fraction = domainFraction(state, d, missionsById);
        const available = d.missions.filter((m) => m.available).length;
        return h('li', { class: 'card domain-card' },
          h('p', { class: 'eyebrow' }, `Week ${d.week} · ${d.weight[0]}–${d.weight[1]}% of the exam`),
          h('h3', {}, h('a', { href: href.domain(d.id) }, d.title)),
          meter(fraction, 'Domain progress'),
          h('p', { class: 'muted small' }, `${available} of ${d.missions.length} missions published`),
        );
      })),
    ),

    h('div', { class: 'grid two' },
      h('section', { class: 'card', 'aria-labelledby': 'weak-h' },
        h('h2', { id: 'weak-h' }, 'Revise next'),
        weak.length === 0
          ? h('p', { class: 'muted' }, 'No weak topics yet. They appear as you use hints, miss quiz questions or reveal solutions early.')
          : h('ol', {}, weak.map((w) => h('li', {}, topics[w.topic].title, h('span', { class: 'muted' }, ` — score ${w.score}`)))),
        h('a', { href: href.revision() }, 'Open revision plan'),
      ),
      h('section', { class: 'card', 'aria-labelledby': 'ach-h' },
        h('h2', { id: 'ach-h' }, 'Achievements'),
        h('p', {}, `${earned.length} of ${achievements.length} earned`),
        earned.length > 0 && h('p', { class: 'trophies' }, earned.map((a) => h('span', { title: a.title }, h('span', { 'aria-hidden': 'true' }, a.icon), h('span', { class: 'visually-hidden' }, a.title)))),
        h('a', { href: href.achievements() }, 'See all achievements'),
      ),
    ),
    h('p', { class: 'muted small' }, `Domain weights use the midpoint of each exam range (${domains.map((d) => weightMidpoint(d)).join(' / ')}).`),
  );
  return { title: 'Dashboard', node };
}

/** Render the storage warning banner, if any. */
export function storageBanner(app) {
  return app.store.warning ? notice('warn', app.store.warning, ' ', h('a', { href: href.settings() }, 'Settings')) : null;
}
