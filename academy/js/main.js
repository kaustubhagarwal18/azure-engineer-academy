// App shell: wires storage, content and the router to the views. This is the only module that
// touches window/location/fetch directly; everything below it is either pure (core/) or a view.

import { createStore } from './core/store.js';
import { loadContent } from './core/content.js';
import { parseRoute, href } from './core/router.js';
import { h, notice } from './ui/dom.js';
import { dashboardView, storageBanner } from './ui/dashboard.js';
import { domainView, missionView } from './ui/mission.js';
import { taskView } from './ui/task.js';
import { quizView } from './ui/quiz.js';
import { revisionView, achievementsView, settingsView } from './ui/pages.js';

const VIEWS = {
  dashboard: dashboardView,
  domain: domainView,
  mission: missionView,
  task: taskView,
  quiz: quizView,
  revision: revisionView,
  achievements: achievementsView,
  settings: settingsView,
};

/** localStorage if it is usable; null in private modes or when site data is blocked. */
function browserStorage() {
  try {
    const s = window.localStorage;
    const probe = '__aea_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Fetch and parse a JSON file relative to the page; throws a readable error on failure. */
async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`);
  return res.json();
}

/** A view for routes that do not exist. */
function notFoundView() {
  return {
    title: 'Not found',
    node: h('div', { class: 'stack' }, h('h1', {}, 'Page not found'), h('p', {}, 'That link does not match any page. ', h('a', { href: href.dashboard() }, 'Go to the dashboard'), '.')),
  };
}

/** Show a load failure with the command that fixes the most common cause. */
function showLoadError(main, error) {
  const fromFile = window.location.protocol === 'file:';
  main.replaceChildren(h('div', { class: 'stack' },
    h('h1', {}, 'The academy could not start'),
    fromFile
      ? notice('error', 'Browsers block loading course files from a page opened directly from disk. Serve the repository folder instead:')
      : notice('error', error.message),
    fromFile && h('pre', { class: 'code' }, h('code', {}, 'python3 -m http.server 8000')),
    fromFile && h('p', {}, 'Run it in the repository root, then open http://localhost:8000/academy/'),
  ));
}

/** Start the app. */
async function start() {
  const main = document.getElementById('main');
  const banner = document.getElementById('banner');
  const announcer = document.getElementById('announcer');
  const store = createStore(browserStorage());

  let content;
  try {
    content = await loadContent(fetchJson);
  } catch (error) {
    showLoadError(main, error);
    return;
  }

  const app = {
    content,
    store,
    /** Announce a short message to screen readers. */
    announce(message) {
      announcer.textContent = '';
      window.setTimeout(() => { announcer.textContent = message; }, 50);
    },
    /** Re-render the current route, keeping scroll position, then focus an element by id. */
    rerender({ focusId } = {}) {
      render({ focusId, keepScroll: true });
    },
  };

  /** Render the route in the URL hash. */
  function render({ focusId, keepScroll = false } = {}) {
    const route = parseRoute(window.location.hash);
    const view = VIEWS[route.name];
    const result = (view && view(app, route.params)) || notFoundView();
    const y = window.scrollY;
    main.replaceChildren(result.node);
    banner.replaceChildren(...[storageBanner(app)].filter(Boolean));
    document.title = `${result.title} · Azure Engineer Academy`;

    for (const link of document.querySelectorAll('.site-nav a')) {
      if (link.dataset.route === route.name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    if (keepScroll) window.scrollTo(0, y);
    const target = focusId && document.getElementById(focusId);
    if (target) target.focus();
  }

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
    // Move focus to the page heading so keyboard and screen-reader users start at the new content.
    const heading = document.querySelector('#main h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  });
  render();
}

start();
