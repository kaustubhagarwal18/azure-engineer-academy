// Progress persistence. The storage backend is injected (window.localStorage in the browser,
// a fake in tests). Every read and write is wrapped: private windows and blocked site data make
// localStorage throw or vanish, and the academy must keep working in memory when that happens.

export const STORAGE_KEY = 'aea.progress.v1';
export const STATE_VERSION = 1;

/** A fresh, empty progress state. */
export function emptyState() {
  return { version: STATE_VERSION, tasks: {}, quiz: {} };
}

/** True when a value has the shape of a saved progress state (used for loads and imports). */
export function isValidState(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.version === STATE_VERSION &&
    value.tasks !== null && typeof value.tasks === 'object' && !Array.isArray(value.tasks) &&
    value.quiz !== null && typeof value.quiz === 'object' && !Array.isArray(value.quiz)
  );
}

/**
 * Create a store around a storage backend ({ getItem, setItem, removeItem }) or null.
 * Returns { getState, update, reset, exportJson, importJson, persistent, warning }.
 * `persistent` is false when storage is unavailable; `warning` explains why, for the UI.
 */
export function createStore(storage) {
  let persistent = Boolean(storage);
  let warning = persistent ? null : 'Browser storage is unavailable, so progress lasts only until you close this tab.';
  let state = emptyState();

  if (persistent) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (isValidState(parsed)) {
          state = parsed;
        } else {
          // Never overwrite data we cannot read: stay in memory until the learner chooses Reset.
          persistent = false;
          warning = `Saved progress is in an unrecognised format. It has been left untouched in browser storage (key ${STORAGE_KEY}), and new progress is not being saved. Choose Reset in Settings to start saving again.`;
        }
      }
    } catch {
      // Covers storage that throws and saved bytes that are not JSON; both are left untouched.
      persistent = false;
      warning = 'Saved progress could not be read, so new progress lasts only until you close this tab. Choose Reset in Settings to start saving again.';
    }
  }

  /** Write the current state; on failure, switch to memory-only and say so. */
  function save() {
    if (!persistent) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      persistent = false;
      warning = 'Progress could not be saved (storage full or blocked). Export it from Settings to keep it.';
    }
  }

  return {
    /** The current state (treat as read-only; change it through update). */
    getState: () => state,
    /** Replace the state with fn(state) and persist it. */
    update(fn) {
      state = fn(state);
      save();
      return state;
    },
    /** Clear all progress. An explicit reset is also how the learner re-enables saving after a read problem. */
    reset() {
      state = emptyState();
      if (storage) {
        persistent = true;
        warning = null;
      }
      save();
    },
    /** Serialise progress for a backup file. */
    exportJson: () => JSON.stringify(state, null, 2),
    /** Replace progress from a backup; returns an error message, or null on success. */
    importJson(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return 'That file is not valid JSON.';
      }
      if (!isValidState(parsed)) return 'That file is not an Azure Engineer Academy progress export (version ' + STATE_VERSION + ').';
      state = parsed;
      save();
      return null;
    },
    get persistent() { return persistent; },
    get warning() { return warning; },
  };
}
