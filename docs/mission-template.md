# Mission template

Every mission follows this structure. Copy this file to
`missions/mission-NNN-<slug>/README.md` and fill each section. Keep theory short — a mission is
a lab, not a textbook chapter. Solutions and exam answers go inside collapsible
`<details>` blocks so the learner attempts first.

---

## Mission NNN — <title>

| | |
|---|---|
| **AZ-104 objective** | <domain> → <sub-skill> |
| **Difficulty** | Guided · Independent · Production Incident (mark which tracks exist) |
| **Estimated time** | ~60 min (10 concepts / 25 build / 15 troubleshoot / 10 exam) |
| **Prerequisites** | <missions or knowledge> |
| **Billable?** | <yes/no — name any resource that costs money and the cleanup step> |

### Scenario
A believable problem from an organisation running Azure. State the business and technical
context in a few sentences.

### Learning objectives
After this mission you can:
- …
- …

### Architecture
- Services involved and how they relate (diagram if it helps — mermaid or ASCII).
- Security considerations.
- Cost considerations.

### Short theory
Only the concepts needed to do the task. For an experienced engineer, lead with the mapping
from what they already know (Linux, networking, CI/CD) to the Azure service.

### Hands-on tasks
Break the build into small tasks. For each:
- **Requirement** — what to achieve.
- **Expected outcome** — how you'll know it worked.
- **Your attempt** — space to try the CLI and Bicep yourself.
- **Hints** — progressive, inside `<details>`.
- **Solution** — CLI and Bicep, inside `<details>`, revealed last.

### Validation
Commands that prove the implementation works, with expected output and common failure cases.

### Troubleshooting
A broken or surprising situation to diagnose. Ask the learner for the cause before giving it.

### Production considerations
Security · reliability · scalability · cost · operations · trade-offs.

### AZ-104 assessment
MCQ, scenario, command-interpretation, and troubleshooting questions. Answers in `<details>`.

### Mission completion
Clear done-criteria, and the line to copy into the repo-root [PROGRESS.md](../PROGRESS.md).
(From a real mission at `missions/mission-NNN/README.md`, that link is `../../PROGRESS.md`.)

## Interactive content (academy)

Every published mission also has a data file for the interactive academy:
`academy/content/missions/<id>.json`. It holds the tasks, hints, rule checks, solutions and
quiz, and `academy/content/domains.json` marks the mission `"available": true`.

**The README and the JSON describe the same mission and must stay in sync.** The README is the
long-form reference: architecture, theory, full CLI and Bicep. The JSON is the hands-on
practice. When you change a task, requirement, solution or exam question in one, change the
other in the same commit.

Rules for the JSON (`node --test` in `academy/` enforces them):

- Every task has a scenario, a concrete challenge, at least one hint (ordered from vague to
  specific), at least one `require` check, and a solution with an explanation.
- The reference solution must pass all of its own checks, and an empty or unrelated answer
  must fail them.
- Each check's `mistake` text explains the concept behind the error, not just the fix.
- Accept every equivalent valid form you know of (short and long flags, alternative scope
  syntax). A check that rejects a correct answer teaches the wrong lesson.
- Open-ended answers (incident write-ups, predictions) use `"review": "mentor"`. Their checks
  only confirm the key points are covered, and completion needs a mentor PASS.
- Every topic must exist in `academy/content/topics.json`, with Microsoft Learn links that you
  have opened and checked.
