// Shared test helpers: load the real content files from disk and build small fixtures.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ACADEMY = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read and parse a JSON file relative to academy/. */
export function readJson(relPath) {
  return JSON.parse(readFileSync(join(ACADEMY, relPath), 'utf8'));
}

/** fetchJson stand-in for loadContent(): reads from disk instead of the network. */
export async function fetchFromDisk(relPath) {
  return readJson(relPath);
}

/** A minimal valid task, overridable per test. */
export function makeTask(overrides = {}) {
  return {
    id: 't1', title: 'Task', scenario: 's', challenge: 'c', answerType: 'cli', review: 'auto',
    topics: ['tags'], hints: ['h1', 'h2'],
    checks: [{ id: 'c1', kind: 'require', pattern: 'az group create', description: 'd', mistake: 'm' }],
    solution: { code: 'az group create', explanation: 'e' },
    ...overrides,
  };
}

/** A minimal valid mission with one task per mode and one quiz question. */
export function makeMission(overrides = {}) {
  const mode = (id) => ({ intro: 'i', tasks: [makeTask({ id })] });
  return {
    id: 'm900', domain: 'identity-governance', title: 'Fixture mission',
    modes: { guided: mode('g1'), independent: mode('i1'), incident: mode('p1') },
    quiz: [{ id: 'q1', prompt: 'p', options: ['a', 'b'], answer: 0, explanation: 'x', topics: ['tags'] }],
    ...overrides,
  };
}

/** A fake storage backend recording writes; can be told to throw on read or write. */
export function fakeStorage({ initial = {}, throwOnGet = false, throwOnSet = false } = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(k) { if (throwOnGet) throw new Error('blocked'); return k in data ? data[k] : null; },
    setItem(k, v) { if (throwOnSet) throw new Error('quota'); data[k] = v; },
    removeItem(k) { delete data[k]; },
  };
}
