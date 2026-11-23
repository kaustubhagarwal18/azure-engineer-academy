# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[semantic versioning](https://semver.org/). It stays on `0.x` while structure can still change.

## [Unreleased]

### Fixed
- **Mission 001 `deploy.sh`:** the role-assignment retry loop now stops the deployment with
  exit code 1 when all 5 attempts fail, and prints the Azure CLI's last error. Before, it
  slept after the final failure, then went on to create the policy and lock and exited 0.
  It also no longer discards the CLI's stderr (`2>/dev/null`).
- **Mission 001 `cleanup.sh`:** errors are no longer suppressed wholesale (`2>/dev/null || true`).
  Objects that are already absent are reported as `skip`. Any other failure is printed with
  the CLI's message, later steps still run, and the script exits 1. End-of-input at the
  confirmation prompt now aborts cleanly instead of exiting 1 with no message.
- **Mission 001 `validate.sh`:** now checks configuration, not just existence: custom-role
  actions (and the absence of `*`, `*/write` and `*/delete`) and its assignable scope; the
  role assignment's principal, role and exact scope; the policy effect and rule; the policy
  assignment's scope and enforcement mode; and the lock level. Each `FAIL` shows expected vs actual.

### Added
- `cli/_common.sh`: one shared copy of the configuration, validation and login check for
  all three scripts. Invalid `ENVIRONMENT`, `RG_NAME` or `IDENTITY_NAME`, or an
  explicitly empty variable, stops the script with a one-line `ERROR:` before any Azure call.
- `tests/test_cli.sh` + `tests/fake_az.sh`: 49 offline behavioural tests of the three
  scripts, run against a fake `az`.
- Mission 001 README: "Assignable scopes vs assignment scope" explanation, a table of the
  configuration variables, and a table of what `validate.sh` checks.
- CI workflow `validate-shell`: pinned, checksum-verified ShellCheck 0.11.0, `bash -n` on
  every script, and the mission test suites, as separate jobs with file annotations and
  job summaries.

### Changed
- Deploy commands in the docs use `--parameters main.bicepparam`, not `--template-file`.
- CI workflow `validate-bicep`: verifies the Bicep download's SHA-256, also compiles every
  `.bicepparam` file, and writes a job summary listing each failure.

### Known issues
- The scripts are tested against a fake `az`. The "already absent" messages that
  `cleanup.sh` matches haven't been checked against live Azure output.
- The CI workflows weren't run as part of this change. They were checked offline: YAML
  parse, plus ShellCheck on every `run:` block.

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
