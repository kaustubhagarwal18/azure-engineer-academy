# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[semantic versioning](https://semver.org/). It stays on `0.x` while structure can still change.

## [0.1.0] — 2026-11-23

### Added
- Repository foundation: README, roadmap (verified against the live AZ-104 study guide),
  progress log, changelog, MIT license, and `.gitignore`.
- `docs/mission-template.md` — the canonical structure every mission follows.
- `docs/architecture.md` — platform and capstone architecture with mermaid diagrams.
- ADR 0001 (CLI + Bicep dual track) and ADR 0002 (local, backend-free progress).
- **Mission 001 — Governed landing zone foundations**: the reference implementation, with
  Guided / Independent / Production Incident tracks, matched Azure CLI and Bicep
  implementations, validation and cleanup scripts, troubleshooting, and AZ-104 exam questions.
- `.github/workflows/validate-bicep.yml` — compiles and lints every `.bicep` file on pull
  requests and pushes to `main`.
- `capstone/README.md` — the evolving Azure DevOps application platform spec.
- `assessments/week-1-identity-governance.md` — Week 1 exam-style assessment.

### Known issues
- Phase 3 dashboard not built; progress is file-based.
- Bicep is compile- and lint-validated only; not deployed against a live subscription in this repo.
- Only Mission 001 is complete; Weeks 2–5 are planned.
