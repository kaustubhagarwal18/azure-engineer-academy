# ADR 0001 — Every mission ships both an Azure CLI and a Bicep implementation

- **Status:** accepted
- **Date:** 2026-11-23

## Context

AZ-104 and real Azure operations both require fluency with the imperative Azure CLI and with
declarative infrastructure as code. The exam tests CLI command interpretation; production work
leans on repeatable, reviewable IaC. Teaching only one leaves a gap.

## Decision

Each infrastructure mission implements the **same** resources twice: once with `az` CLI
commands and once with Bicep. The mission text explicitly contrasts them and states when each is
the right tool.

- **CLI** for exploration, one-off operations, break-glass fixes, and quick reads/queries.
- **Bicep** for anything that must be repeatable, reviewed, diffed (`what-if`), or version
  controlled — i.e. the real platform.

Bicep is preferred over raw ARM JSON for authoring (cleaner, modular, typed). ARM JSON is only
mentioned where the exam references it.

## Consequences

- More authoring effort per mission, but the learner builds both muscles and can compare them
  directly.
- Bicep is compiled and linted in CI, giving fast, free feedback without a subscription.
- Where a capability exists only in the CLI/portal (e.g. some preview operations), the mission
  says so rather than forcing an awkward Bicep equivalent.
