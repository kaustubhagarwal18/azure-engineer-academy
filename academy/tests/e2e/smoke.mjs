// End-to-end smoke test in a real headless Chrome, driven over the DevTools protocol with Node's
// built-in WebSocket — no Playwright/Puppeteer dependency. It serves the repository with Python's
// http.server, uses a throwaway browser profile, and walks the main learner flows.
//
// Run from the repository root:  node academy/tests/e2e/smoke.mjs
// Needs Node 22+ and Chrome/Chromium. Set CHROME=/path/to/chrome if it is not found automatically.
// Optional: SCREENSHOT_DIR=docs/images writes dashboard.png and task.png there.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error('ERROR: Chrome/Chromium not found. Set CHROME=/path/to/chrome and re-run.');
  process.exit(2);
}

const HTTP_PORT = 8765 + Math.floor(Math.random() * 500);
const CDP_PORT = 9265 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${HTTP_PORT}/academy/`;
const profile = mkdtempSync(join(tmpdir(), 'aea-chrome-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const pageErrors = [];

/** Record one assertion. */
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  ok    ${name}`); } else { failed += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
const chromeArgs = [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu',
];
// GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs. The runner is a
// throwaway VM loading only this repo's local pages, so the sandbox is dropped there and only there.
if (process.env.CI) chromeArgs.push('--no-sandbox');
const chrome = spawn(CHROME, [...chromeArgs, 'about:blank'], { stdio: 'ignore' });

/** Stop the browser and server and remove the temporary profile. */
function cleanup() {
  chrome.kill();
  server.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

/** Poll until fn() resolves truthy or the timeout passes. */
async function waitFor(fn, timeoutMs = 8000, what = 'condition') {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready yet */ }
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

try {
  await waitFor(async () => (await fetch(BASE)).ok, 10000, 'http.server');
  const targets = await waitFor(async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json(), 15000, 'Chrome DevTools');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true });
    }
  };
  /** Send a CDP command. */
  const send = (method, params = {}) => new Promise((res, rej) => {
    id += 1;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  /** Evaluate an expression in the page and return its value. */
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result.value;
  };
  /** Navigate to a hash route and wait for its h1. */
  const go = async (hash, h1Text) => {
    await js(`location.hash = ${JSON.stringify(hash)}`);
    await waitFor(() => js(`document.querySelector('#main h1')?.textContent.includes(${JSON.stringify(h1Text)})`), 8000, `h1 "${h1Text}"`);
  };
  /** Type into a textarea (firing input so drafts are kept) and submit its form. */
  const answer = (text) => js(`(() => { const t = document.getElementById('answer'); t.value = ${JSON.stringify(text)}; t.dispatchEvent(new Event('input', { bubbles: true })); t.form.requestSubmit(); })()`);
  const text = () => js('document.getElementById("main").innerText');
  /** No horizontal page scroll at the current viewport. */
  const noHScroll = () => js('document.documentElement.scrollWidth <= window.innerWidth');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });

  console.log('Dashboard');
  await send('Page.navigate', { url: `${BASE}#/` });
  await waitFor(() => js(`document.querySelector('#main h1')?.textContent === 'AZ-104 progress'`), 10000, 'dashboard');
  let t = await text();
  check('renders the five domains', (await js('document.querySelectorAll(".domain-card").length')) === 5);
  check('overall progress starts at 0%', t.includes('Overall AZ-104 progress') && t.includes('0%'));
  check('says how much content is published', t.includes('1 of 12 planned missions'));
  check('offers the first task to continue', t.includes('Create a tagged resource group'));

  console.log('Task: empty submit, wrong answer, hints, correct answer');
  await go('#/mission/m001/guided/g1-resource-group', 'Create a tagged resource group');
  check('solution is locked before any attempt', await js('[...document.querySelectorAll("button")].find(b => b.textContent === "Reveal solution")?.disabled === true'));
  await answer('   ');
  check('empty submit shows an error and does not count', await js('!document.getElementById("answer-error").hidden && !document.getElementById("feedback-h")'));
  await answer('az group create --name rg-academy-governance --location westeurope --tags costCenter=platform-engineering,environment=dev');
  await waitFor(() => js('!!document.getElementById("feedback-h")'), 5000, 'feedback');
  t = await text();
  check('wrong answer reports which checks failed', /Automated checks: \d of 6 passed/.test(t) && !t.includes('6 of 6'));
  check('explains the comma-separated tag mistake', t.includes('becomes ONE tag'));
  check('focus moves to the feedback heading', await js('document.activeElement?.id === "feedback-h"'));
  check('solution unlocks after an attempt', await js('!!document.getElementById("solution-btn")'));
  for (let i = 0; i < 3; i += 1) await js('document.getElementById("hint-btn")?.click()');
  check('hints reveal one by one until all are shown', (await js('document.querySelectorAll("#hint-list li").length')) === 3 && (await text()).includes('All hints shown.'));
  check('the typed answer survives re-renders', (await js('document.getElementById("answer").value')).includes('costCenter=platform-engineering,environment=dev'));
  await answer('az group create \\\n  --name rg-academy-governance \\\n  --location westeurope \\\n  --tags costCenter=platform-engineering environment=dev');
  await waitFor(() => js('document.getElementById("main").innerText.includes("6 of 6 passed")'), 5000, '6 of 6');
  check('a correct multi-line answer passes all checks', true);
  check('status becomes Complete', (await text()).includes('Complete'));

  console.log('Persistence');
  await send('Page.reload');
  await waitFor(() => js(`document.querySelector('#main h1')?.textContent === 'Create a tagged resource group'`), 8000, 'reload');
  check('progress survives a reload (localStorage)', (await text()).includes('Complete'));

  console.log('Mentor review on an incident task');
  await go('#/mission/m001/incident/p2-scope-locked', 'Nobody can delete a stale resource group');
  await answer('ScopeLocked is caused by the CanNotDelete lock. Get approval, then remove the lock deliberately with az lock delete, then delete the RG.');
  await waitFor(() => js('!!document.getElementById("feedback-h")'), 5000, 'feedback');
  t = await text();
  check('keyword checks pass but the task still needs a mentor', t.includes('3 of 3 passed') && t.includes('Needs mentor review'));
  await js('document.getElementById("prompt-text").closest("details").open = true');
  await waitFor(() => js('document.getElementById("prompt-text").value.length > 0'), 3000, 'prompt');
  const prompt = await js('document.getElementById("prompt-text").value');
  check('mentor prompt contains the scenario and answer but not the solution',
    prompt.includes('gets `ScopeLocked`') && prompt.includes('remove the lock deliberately') && !prompt.includes('The lock did its job'));
  await js('[...document.querySelectorAll("button")].find(b => b.textContent === "Mentor said PASS").click()');
  await waitFor(() => js('document.getElementById("main").innerText.includes("Recorded: PASS")'), 5000, 'verdict');
  check('a mentor PASS completes the task', (await text()).match(/Nobody can delete a stale resource group\s*✓ Complete/) !== null);

  console.log('Quiz');
  await go('#/mission/m001/quiz', 'M001 quiz');
  await js('document.getElementById("q-q1-additive-0").click(); document.getElementById("q-q1-additive-0").form.requestSubmit()');
  await waitFor(() => js('!!document.getElementById("q-q1-additive-feedback")'), 5000, 'quiz feedback');
  check('a wrong option shows that option\'s feedback', (await js('document.getElementById("q-q1-additive-feedback").innerText')).includes('no "closest scope wins" rule'));
  await js('document.getElementById("q-q1-additive-1").click(); document.getElementById("q-q1-additive-1").form.requestSubmit()');
  await waitFor(() => js('document.getElementById("q-q1-additive-feedback")?.innerText.includes("Correct.")'), 5000, 'correct');
  check('the right option shows the explanation and notes the missed first try', (await js('document.getElementById("q-q1-additive-feedback").innerText')).includes('Missed on the first try'));

  console.log('Revision, achievements, dashboard');
  await go('#/revision', 'Weak topics');
  t = await text();
  check('revision ranks topics from real signals', t.includes('Tags and cost attribution') && t.includes('RBAC scope and inheritance'));
  check('revision links to Microsoft Learn', await js('[...document.querySelectorAll("#main a")].some(a => a.href.startsWith("https://learn.microsoft.com/"))'));
  await go('#/achievements', 'Achievements');
  t = await text();
  check('"First solve" is earned', /First solve\s*Earned/.test(t));
  check('"Mission complete" is still locked', /Mission complete\s*Locked/.test(t));
  await go('#/', 'AZ-104 progress');
  check('overall progress moved above 0%', !(await js('document.querySelector(".meter-lg .meter-value").textContent')).startsWith('0%'));
  if (process.env.SCREENSHOT_DIR) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(process.env.SCREENSHOT_DIR, 'dashboard.png'), Buffer.from(shot.data, 'base64'));
  }

  console.log('Not found and accessibility basics');
  await go('#/nope', 'Page not found');
  check('unknown routes show a not-found page', true);
  const pages = ['#/', '#/domain/identity-governance', '#/mission/m001', '#/mission/m001/guided/g4-role-assignment', '#/mission/m001/quiz', '#/revision', '#/achievements', '#/settings'];
  let unlabelled = [];
  let h1s = [];
  for (const p of pages) {
    await js(`location.hash = ${JSON.stringify(p)}`);
    await sleep(150);
    unlabelled = unlabelled.concat(await js(`[...document.querySelectorAll('textarea, input, select')].filter(el => !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))).map(el => '${p} ' + (el.id || el.name || el.type))`));
    h1s.push(await js('document.querySelectorAll("main h1").length'));
  }
  check('every form control has an accessible name', unlabelled.length === 0, unlabelled.join(', '));
  check('every page has exactly one h1', h1s.every((n) => n === 1), JSON.stringify(h1s));
  check('the current page is marked in the main nav', await js('document.querySelector(".site-nav a[aria-current=page]")?.dataset.route === "settings"'));

  console.log('Phone width (375px)');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
  const wide = [];
  for (const p of pages) {
    await js(`location.hash = ${JSON.stringify(p)}`);
    await sleep(200);
    if (!(await noHScroll())) wide.push(p);
  }
  check('no horizontal page scroll on any page at 375px', wide.length === 0, wide.join(', '));
  if (process.env.SCREENSHOT_DIR) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    await go('#/mission/m001/guided/g1-resource-group', 'Create a tagged resource group');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(process.env.SCREENSHOT_DIR, 'task.png'), Buffer.from(shot.data, 'base64'));
  }

  console.log('Reset');
  await go('#/settings', 'Settings');
  await js('[...document.querySelectorAll("button")].find(b => b.textContent === "Reset all progress").click()');
  await sleep(300);
  await go('#/', 'AZ-104 progress');
  check('reset (after confirming) returns progress to 0%', (await js('document.querySelector(".meter-lg .meter-value").textContent')) === '0%');

  check('no JavaScript errors in the page', pageErrors.length === 0, pageErrors.join(' | '));
  ws.close();
} catch (err) {
  failed += 1;
  console.log(`  FAIL  ${err.message}`);
} finally {
  cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
