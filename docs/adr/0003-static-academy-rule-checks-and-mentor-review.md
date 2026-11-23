# ADR 0003 — A static academy: rule checks plus a mentor review

- **Status:** accepted
- **Date:** 2026-11-23

## Context

The learner wants an interactive interface for solving tasks, not a set of Markdown pages:
domain and mission navigation, three difficulty modes, hints, solution reveal, quizzes,
progress, achievements and a revision plan. ADR 0002 already rules out a backend.

A static page can't genuinely review an answer. It can match patterns, but it can't tell
whether a different command does the same thing, or whether an incident write-up shows good
judgement.

## Decision

1. **Plain HTML, CSS and ES modules, with no build step and no npm dependencies.** The site is
   served as static files (`python3 -m http.server`, or GitHub Pages later). A framework and
   bundler would add a toolchain and a dependency tree to maintain, for a single-user app with
   a handful of views.
2. **Content is data.** `academy/content/*.json` holds domains, topics and missions. The code is
   generic, so adding a mission is a content change. The mission README stays the long-form
   reference, and the template requires the two to be kept in sync.
3. **Logic is separate from the DOM.** `academy/js/core/` holds pure functions (evaluation,
   progress, achievements, weak topics, mentor prompt, routing, storage with an injected
   backend) and is unit-tested under Node. `academy/js/ui/` renders views.
4. **Rule checks are labelled as rule checks.** Each task has `require`/`forbid` regex checks,
   each with a `mistake` explanation. The UI calls them "automated checks" and says they can
   reject valid alternatives and miss subtle errors.
5. **The mentor review is the real judgement.** A button copies a structured prompt with the
   scenario, the challenge, the learner's answer, the check results and the hints used, but
   never the solution. The learner pastes it into ChatGPT or another AI mentor and records the
   verdict. A mentor **PASS** completes a task even if the rule checks failed. **NEEDS WORK**
   un-completes an auto-pass. Open-ended tasks (`review: "mentor"`) complete only with a PASS.
6. **Achievements and weak topics are derived, never stored.** They're recalculated from task
   and quiz records, so they can't drift from real progress.
7. **The solution unlocks only after a non-empty submitted attempt.** Revealing it before
   solving is recorded and counts toward the weak-topic score.

## Consequences

- Zero dependencies and nothing to build. Running it locally is one Python command.
- Opening `index.html` directly from disk doesn't work: browsers block `fetch` of local files.
  The page detects this and prints the command to run.
- Mentor verdicts are self-reported. That's fine for a personal study tool. They aren't a
  credential.
- Progress lives in one browser (ADR 0002). Export and import in Settings are the backup.
- A regex check can wrongly reject a valid answer. Mitigations: a content test requires every
  reference solution to pass its own checks, the content rules require accepting known
  equivalent forms, and a mentor PASS overrides the checks.
- The views are covered by a headless-Chrome smoke test, not by component tests. Its CI job is
  non-blocking until it has proven stable on GitHub's runners.
