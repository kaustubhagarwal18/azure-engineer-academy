# Architecture

This document explains how the academy is put together and how the capstone platform grows as
you complete missions.

## Learning platform

The platform is deliberately static and dependency-light. There is no backend, database, or
auth system. Progress lives in the learner's browser, managed by the interactive academy (see
[ADR 0002](adr/0002-local-progress-no-backend.md) and
[ADR 0003](adr/0003-static-academy-rule-checks-and-mentor-review.md)).

```mermaid
flowchart LR
    L[Learner] --> A[Academy\nacademy/index.html]
    L --> M[Mission README]
    A -->|tasks, quiz| C[(academy/content/*.json)]
    M -. kept in sync .- C
    M -->|CLI path| CLI[cli/*.sh]
    M -->|Bicep path| B[bicep/main.bicep + modules]
    CLI --> AZ[(Azure subscription\n— learner-owned, optional)]
    B --> AZ
    B --> CI[CI: validate-bicep\nbuild + lint]
    A --> LS[(localStorage\nprogress)]
    A -->|copied prompt| MENTOR[AI mentor\nlearner pastes it]
```

## Academy

The academy is plain HTML, CSS and ES modules served as static files. Course content is JSON;
the code is generic, so a new mission is a content change.

```mermaid
flowchart TB
    MAIN["js/main.js (shell: fetch, localStorage, hashchange)"]
    subgraph UI ["js/ui (views)"]
        D[dashboard]
        T[task player]
        Q[quiz]
        P["mission / revision / achievements / settings"]
    end
    subgraph Core ["js/core (pure, unit-tested under Node)"]
        R[router]
        CT["content: load + validate"]
        ST["store: injected storage"]
        EV["evaluate: require / forbid rules"]
        PR["progress: transitions + completion"]
        AC["achievements: derived"]
        WT["weakTopics: scored signals"]
        MP[mentorPrompt]
    end
    MAIN --> R
    MAIN --> CT
    MAIN --> ST
    MAIN --> UI
    T --> EV
    T --> PR
    T --> MP
    Q --> PR
    D --> PR
    D --> AC
    D --> WT
    P --> WT
    P --> AC
```

**How an answer is judged.** `evaluate()` normalises the answer (it joins `\` line
continuations and collapses spaces), then runs the task's checks. A `require` rule passes on a
match and a `forbid` rule passes on no match. An empty answer never passes. A task is
**complete** when the mentor verdict is PASS, or when the rule checks passed, the task isn't
`review: "mentor"`, and the mentor hasn't said NEEDS WORK.

**How progress is weighted.** A mission's fraction is (complete tasks + correctly answered quiz
questions) / (tasks + questions). A domain's fraction is the mean over its *planned* missions,
with unpublished ones counting as 0. Overall progress weights each domain by the midpoint of
its exam-weight range (22.5 / 17.5 / 22.5 / 17.5 / 12.5).

**How weak topics are ranked.** Each task and question carries topics. Struggle signals add
weight to them: a first-try quiz miss +2, solution revealed before solving +2, mentor NEEDS
WORK +2, each hint +0.5, each failed attempt +0.5 (at most 4 counted per task). Topics are
sorted by score, and the revision plan lists unfinished tasks first, with Microsoft Learn links.

Every mission ships the **same infrastructure twice** — once imperatively via the Azure CLI and
once declaratively via Bicep — so you internalise both and learn when each is appropriate
(see [ADR 0001](adr/0001-cli-and-bicep-dual-track.md)).

## Deployment scopes

Governance resources do not all live at the same scope. This matters for Mission 001 and
recurs throughout the curriculum.

```mermaid
flowchart TD
    MG[Management group] --> SUB[Subscription]
    SUB --> RG[Resource group]
    RG --> R[Resources: VMs, storage, VNets...]
    SUB -.policy / RBAC / custom roles.-> SUB
    RG -.locks / tags / role assignments.-> RG
```

A Bicep file declares its `targetScope` (`resourceGroup`, `subscription`, `managementGroup`, or
`tenant`). Picking the wrong scope is a common early mistake and a frequent exam trap.

## Capstone: Azure DevOps application platform

The capstone is assembled incrementally — never all at once. Each week adds the layer you just
learned, so by the end you have deployed a coherent platform from Bicep and GitHub Actions.

```mermaid
flowchart TB
    subgraph Governance [Week 1 — governance]
        G1[Resource groups + tags]
        G2[Custom RBAC + managed identity]
        G3[Azure Policy + locks]
    end
    subgraph Storage [Week 2]
        S1[Storage account + blob/files]
    end
    subgraph Compute [Week 3]
        C1[Linux VMs / scale set / App Service]
    end
    subgraph Network [Week 4]
        N1[VNet + subnets + NSGs]
        N2[Bastion / private endpoints]
    end
    subgraph Observe [Week 5]
        O1[Log Analytics + Monitor + alerts]
        O2[Backup + recovery]
    end
    Governance --> Storage --> Compute --> Network --> Observe
```

## Where to look

| You want to… | Look in |
|--------------|---------|
| See the mission list and status | [ROADMAP.md](../ROADMAP.md) |
| Understand the mission format | [mission-template.md](mission-template.md) |
| Start learning | the academy ([academy/README.md](../academy/README.md)) and [missions/mission-001-identity-governance/README.md](../missions/mission-001-identity-governance/README.md) |
| Change a task, hint, check or quiz question | `academy/content/missions/<id>.json` (keep the mission README in sync) |
| Change how answers are checked or progress is counted | `academy/js/core/evaluate.js`, `academy/js/core/progress.js` |
| Change weak-topic scoring or achievements | `academy/js/core/weakTopics.js`, `academy/js/core/achievements.js` |
| Change the mentor prompt | `academy/js/core/mentorPrompt.js` |
| Test the academy | `academy/tests/` (`node --test`) and `academy/tests/e2e/smoke.mjs` |
| Read a design decision | [adr/](adr/) |
| See how the capstone evolves | [capstone/README.md](../capstone/README.md) |
| Understand CI | [.github/workflows/validate-bicep.yml](../.github/workflows/validate-bicep.yml) |
| Understand the academy's CI | [.github/workflows/validate-academy.yml](../.github/workflows/validate-academy.yml) |
