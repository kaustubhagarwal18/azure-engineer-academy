# ADR 0002 — Progress tracking stays local and backend-free

- **Status:** accepted. Implemented by the academy in `academy/` (see ADR 0003); `PROGRESS.md`
  is now an optional written log.
- **Date:** 2026-11-23

## Context

The academy needs to track mission completion, quiz performance, and achievements. A backend
with a database and auth would be the "obvious" way, but this is a single-learner study repo
that should be cheap, private, and trivially hostable (GitHub Pages later).

## Decision

Progress is stored locally with no server:

- **Now:** a human-readable [PROGRESS.md](../../PROGRESS.md) file in the repo.
- **Phase 3 dashboard:** a static page using browser `localStorage`, suitable for GitHub Pages.

No backend, database, authentication, or cloud infrastructure is introduced solely to track
progress.

## Consequences

- Zero hosting cost and no personal data leaves the machine.
- `localStorage` is per-browser and not synced across devices; acceptable for a personal study
  tool. If cross-device sync is ever wanted, revisit with an explicit, opt-in choice.
- The dashboard must degrade gracefully when storage is empty or blocked (private windows), and
  wrap every storage read/write in try/catch.
- Keeping the model file-based now means the dashboard can be added later without rework.
