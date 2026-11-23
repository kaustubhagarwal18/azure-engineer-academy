# Academy — interactive learning interface

A static page for working through the missions: realistic tasks, hints, rule checks, solutions
after you've tried, exam-style quizzes, a mentor-review workflow, and progress stored in your
browser. No backend, no build step, no dependencies. See
[ADR 0003](../docs/adr/0003-static-academy-rule-checks-and-mentor-review.md) for the reasoning.

## Run it

Run this from the **repository root**, so the links to the mission READMEs work too:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/academy/ in your browser. Stop the server with Ctrl+C.

Opening `index.html` straight from disk doesn't work, because browsers block loading the course
files from `file://` pages. The page says so and shows the command above.

## How a task works

1. Read the **scenario** and the **challenge**.
2. Write your answer: a CLI command, JSON, Bicep, or a written incident analysis.
3. **Check my answer** runs the task's rule checks. Each failed check explains the mistake.
   These are pattern rules for common errors, not a judgement of your answer.
4. Open **hints** one at a time if you're stuck.
5. The **solution** unlocks after your first non-empty attempt. Revealing it before you've
   solved the task is recorded and feeds your revision plan.
6. **Copy review prompt** puts the scenario, your answer, the check results and your hint count
   on the clipboard (never the solution). Paste it into ChatGPT or another AI mentor, then
   record the verdict. A mentor PASS completes the task. Incident write-ups need one.

## What leaves your machine

Nothing, unless you paste the mentor prompt somewhere yourself. There's no server, no account
and no analytics. Progress is in `localStorage` under `aea.progress.v1`; use **Settings →
Export** for a backup, since clearing site data deletes it.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `css/academy.css` | Page shell and styles (light/dark follows the OS) |
| `js/main.js` | Wires storage, content and routing to the views |
| `js/core/` | Pure logic, unit-tested under Node: `evaluate`, `progress`, `achievements`, `weakTopics`, `mentorPrompt`, `content` (load + validate), `router`, `store`, `text` |
| `js/ui/` | Views: dashboard, domain/mission, task player, quiz, revision/achievements/settings |
| `content/domains.json` | The five AZ-104 domains, exam weights, and which missions are published |
| `content/topics.json` | Topic catalogue with Microsoft Learn links (used by the revision plan) |
| `content/missions/<id>.json` | One mission: three modes of tasks, plus the quiz |
| `tests/*.test.js` | Unit and content-integrity tests (`node --test`) |
| `tests/e2e/smoke.mjs` | Headless-Chrome walkthrough of the main flows |

## Test

Unit and content tests need Node 22 or later:

```sh
cd academy
node --test "tests/*.test.js"
```

The browser smoke test needs Chrome or Chromium. Run it from the repository root; it starts its
own server and a throwaway browser profile:

```sh
node academy/tests/e2e/smoke.mjs
```

To refresh the README screenshots while it runs:

```sh
SCREENSHOT_DIR=docs/images node academy/tests/e2e/smoke.mjs
```

## Add a mission

1. Write `academy/content/missions/<id>.json` (copy `m001.json` for the shape).
2. Set `"available": true` for it in `content/domains.json`.
3. Run the tests. They reject unknown topics, invalid regexes, missing hints or solutions, and
   any reference solution that fails its own checks.

Keep the JSON in sync with the mission README. See "Interactive content" in
[docs/mission-template.md](../docs/mission-template.md).
