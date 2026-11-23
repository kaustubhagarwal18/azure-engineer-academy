# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[semantic versioning](https://semver.org/). It stays on `0.x` while structure can still change.

## [Unreleased]

### Added
- **Interactive academy** (`academy/`): a static, dependency-free learning interface.
  - Dashboard with AZ-104 progress weighted by exam domain. It says how much content is
    published, so the percentage isn't read as exam readiness.
  - Domain and mission pages with Guided, Independent and Production Incident modes.
  - Task player: scenario, challenge, answer box, rule checks that explain each mistake,
    progressive hints, solution unlocked only after a non-empty attempt.
  - Mentor review: copies a prompt (never including the solution) for ChatGPT or another AI
    mentor, and records the PASS / NEEDS WORK verdict. A mentor PASS completes a task;
    incident write-ups need one.
  - Quizzes with feedback for every option, a weak-topic revision plan with Microsoft Learn
    links, achievements calculated from real completion, and localStorage persistence with
    export, import and reset.
  - Accessibility: skip link, labelled controls, focus management, live announcements, a
    single h1 per page, and AA contrast in light and dark themes (lowest measured 5.78:1).
  - Responsive down to 375 px.
- Mission 001 content for the academy: 13 tasks (6 Guided, 4 Independent, 3 Production
  Incident) and a 9-question quiz.
- Tests: 139 Node unit and content-integrity tests, including "every reference solution passes
  its own checks", plus a 32-step headless-Chrome smoke test driven over the DevTools protocol
  with no dependencies.
- CI workflow `validate-academy`: a blocking `unit` job and a non-blocking `e2e` job.
- ADR 0003 (static academy, rule checks plus mentor review); `academy/README.md`; README
  screenshots; an "Interactive content" section in the mission template.

### Changed
- `PROGRESS.md` is now an optional written log; the academy tracks progress itself.

### Known issues
- Rule checks are regex patterns and can wrongly reject an unanticipated valid answer. A mentor
  PASS overrides them.
- Progress is per browser, and mentor verdicts are self-reported.
- The smoke test has only been run on macOS, so its CI job is non-blocking.
- Mission content lives in both the README and the academy JSON, and is kept in sync by hand.

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
