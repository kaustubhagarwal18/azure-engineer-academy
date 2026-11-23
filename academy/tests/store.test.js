// Tests for progress persistence, including blocked and corrupted storage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, emptyState, STORAGE_KEY } from '../js/core/store.js';
import { fakeStorage } from './helpers.js';

test('starts empty and persists updates', () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  assert.deepEqual(store.getState(), emptyState());
  store.update((s) => ({ ...s, tasks: { a: { attempts: 1 } } }));
  assert.equal(JSON.parse(storage.data[STORAGE_KEY]).tasks.a.attempts, 1);
  assert.equal(store.persistent, true);
  assert.equal(store.warning, null);
});

test('reloads saved progress', () => {
  const saved = { ...emptyState(), quiz: { 'm001/q1': { correct: true } } };
  const store = createStore(fakeStorage({ initial: { [STORAGE_KEY]: JSON.stringify(saved) } }));
  assert.deepEqual(store.getState(), saved);
});

test('no storage at all: works in memory and warns', () => {
  const store = createStore(null);
  store.update((s) => ({ ...s, tasks: { a: {} } }));
  assert.ok(store.getState().tasks.a);
  assert.equal(store.persistent, false);
  assert.match(store.warning, /unavailable/);
});

test('storage that throws on read falls back to memory with a warning', () => {
  const store = createStore(fakeStorage({ throwOnGet: true }));
  assert.equal(store.persistent, false);
  assert.match(store.warning, /could not be read/);
  store.update((s) => s);
});

test('a blocked store that is reset stays memory-only rather than claiming to save', () => {
  const store = createStore(null);
  store.reset();
  assert.equal(store.persistent, false);
});

test('storage that throws on write keeps going in memory and warns', () => {
  const store = createStore(fakeStorage({ throwOnSet: true }));
  store.update((s) => ({ ...s, tasks: { a: {} } }));
  assert.ok(store.getState().tasks.a);
  assert.equal(store.persistent, false);
  assert.match(store.warning, /could not be saved/);
});

for (const [name, raw] of [['corrupt JSON', '{not json'], ['wrong version', JSON.stringify({ version: 99, tasks: {}, quiz: {} })], ['wrong shape', JSON.stringify({ version: 1, tasks: [] })]]) {
  test(`unreadable saved progress (${name}) is never overwritten until the learner resets`, () => {
    const storage = fakeStorage({ initial: { [STORAGE_KEY]: raw } });
    const store = createStore(storage);
    assert.deepEqual(store.getState(), emptyState());
    assert.equal(store.persistent, false);
    assert.ok(store.warning);
    store.update((s) => ({ ...s, tasks: { a: { attempts: 1 } } }));
    assert.equal(storage.data[STORAGE_KEY], raw, 'original bytes kept after an update');
    store.reset();
    assert.equal(store.persistent, true, 'reset re-enables saving');
    assert.equal(store.warning, null);
    assert.deepEqual(JSON.parse(storage.data[STORAGE_KEY]), emptyState());
  });
}

test('export then import round-trips, and bad imports are rejected with a reason', () => {
  const a = createStore(fakeStorage());
  a.update((s) => ({ ...s, tasks: { 'm001/guided/g1': { attempts: 2 } } }));
  const b = createStore(fakeStorage());
  assert.equal(b.importJson(a.exportJson()), null);
  assert.deepEqual(b.getState(), a.getState());
  assert.match(b.importJson('nope'), /not valid JSON/);
  assert.match(b.importJson('{"version":1}'), /not an Azure Engineer Academy progress export/);
  assert.deepEqual(b.getState(), a.getState(), 'a failed import leaves progress unchanged');
});

test('reset clears progress', () => {
  const store = createStore(fakeStorage());
  store.update((s) => ({ ...s, tasks: { a: {} } }));
  store.reset();
  assert.deepEqual(store.getState(), emptyState());
});
