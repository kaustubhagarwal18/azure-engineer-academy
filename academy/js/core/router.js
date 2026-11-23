// Hash routing. Hash URLs work on any static host (GitHub Pages, python -m http.server) with no
// server rewrite rules, and the back button works for free.

import { MODES } from './progress.js';

/**
 * Parse a location hash into a route: { name, params }. Unknown or malformed hashes return
 * { name: 'not-found' } so the UI can say so instead of rendering a blank page.
 *
 *   #/                                  dashboard
 *   #/domain/<domainId>                 domain
 *   #/mission/<missionId>               mission
 *   #/mission/<missionId>/quiz          quiz
 *   #/mission/<missionId>/<mode>/<taskId>   task
 *   #/revision  #/achievements  #/settings
 */
export function parseRoute(hash) {
  const path = String(hash ?? '').replace(/^#\/?/, '').replace(/\/+$/, '');
  const parts = path === '' ? [] : path.split('/').map((p) => {
    try { return decodeURIComponent(p); } catch { return null; }
  });
  if (parts.includes(null)) return { name: 'not-found', params: {} };
  const [head, a, b, c] = parts;

  if (parts.length === 0) return { name: 'dashboard', params: {} };
  if (parts.length === 1 && ['revision', 'achievements', 'settings'].includes(head)) return { name: head, params: {} };
  if (head === 'domain' && parts.length === 2) return { name: 'domain', params: { domainId: a } };
  if (head === 'mission' && parts.length === 2) return { name: 'mission', params: { missionId: a } };
  if (head === 'mission' && parts.length === 3 && b === 'quiz') return { name: 'quiz', params: { missionId: a } };
  if (head === 'mission' && parts.length === 4 && MODES.includes(b)) return { name: 'task', params: { missionId: a, mode: b, taskId: c } };
  return { name: 'not-found', params: {} };
}

/** Build a hash for a route; the inverse of parseRoute. */
export const href = {
  dashboard: () => '#/',
  domain: (domainId) => `#/domain/${encodeURIComponent(domainId)}`,
  mission: (missionId) => `#/mission/${encodeURIComponent(missionId)}`,
  quiz: (missionId) => `#/mission/${encodeURIComponent(missionId)}/quiz`,
  task: (missionId, mode, taskId) => `#/mission/${encodeURIComponent(missionId)}/${mode}/${encodeURIComponent(taskId)}`,
  revision: () => '#/revision',
  achievements: () => '#/achievements',
  settings: () => '#/settings',
};
