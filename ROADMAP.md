# Roadmap

The curriculum is built around the official Microsoft AZ-104 study guide. The domains and
weights below are **verified against the live study guide**
(https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104),
whose skills list is labelled **"Skills measured as of October 26, 2023"** (page last updated
2026-11-05, list unchanged). If Microsoft republishes the objectives, update this table and the
affected missions in the same change.

## AZ-104 domains → weeks

| Week | Domain | Weight | Sub-skills (from the study guide) |
|------|--------|--------|-----------------------------------|
| 1 | Manage Azure identities and governance | 20–25% | Manage Microsoft Entra users and groups · Manage access to Azure resources · Manage Azure subscriptions and governance |
| 2 | Implement and manage storage | 15–20% | Configure access to storage · Configure and manage storage accounts · Configure Azure Files and Azure Blob Storage |
| 3 | Deploy and manage Azure compute resources | 20–25% | Automate deployment with ARM/Bicep · Create and configure VMs · Provision and manage containers · Create and configure Azure App Service |
| 4 | Implement and manage virtual networking | 15–20% | Configure and manage virtual networks · Configure secure access to virtual networks · Configure name resolution and load balancing |
| 5 | Monitor and maintain Azure resources | 10–15% | Monitor resources in Azure · Implement backup and recovery |

Passing is scaled; treat ~700/1000 as the bar and aim comfortably above it.

## Missions

Legend: ✅ done · 🚧 in progress · ⬜ planned

### Week 1 — Identities and governance
- ✅ **M001 — Governed landing zone foundations** (Guided / Independent / Production Incident):
  management group + resource groups, custom RBAC role + assignment, Azure Policy (require a
  `costCenter` tag), resource locks, tags, and a user-assigned managed identity.
- ⬜ M002 — Entra users, groups, and administrative units at scale.
- ⬜ M003 — Managed identities end to end (system- vs user-assigned, role assignments).

### Week 2 — Storage
- ⬜ M010 — Storage accounts, redundancy, access tiers, lifecycle management.
- ⬜ M011 — Blob + Azure Files, SAS, networking restrictions, data protection.

### Week 3 — Compute
- ⬜ M020 — Linux VMs: sizing, availability, disks/snapshots, troubleshooting.
- ⬜ M021 — VM Scale Sets and autoscale.
- ⬜ M022 — App Service and containers (ACI / Container Apps where relevant).

### Week 4 — Virtual networking
- ⬜ M030 — VNets, subnets, NSGs, ASGs, peering, UDRs.
- ⬜ M031 — DNS, VPN Gateway, Bastion, private endpoints, network troubleshooting.

### Week 5 — Monitor and maintain
- ⬜ M040 — Azure Monitor, Log Analytics, KQL, metrics/logs, alerts, diagnostic settings.
- ⬜ M041 — Backup and recovery; Azure Site Recovery concepts; Network Watcher.

### Final preparation
- ⬜ Full-length timed mock assessments and weak-area review.
- ⬜ Capstone sign-off: the Azure DevOps application platform deployed from Bicep + GitHub Actions.

## Phases (build order for this repo)

1. ✅ **Phase 1 — Foundation:** repo scaffold, README, roadmap, mission template, CI.
2. ✅ **Phase 2 — Mission 001** as the reference implementation (CLI + Bicep, validation,
   troubleshooting, exam questions, cleanup/cost).
3. ⬜ **Phase 3 — Dashboard:** static, local-storage progress UI (no backend). Deferred by design.
4. ⬜ **Phase 4 — Remaining missions** (Weeks 2–5), each feeding the capstone.
5. ⬜ **Phase 5 — Portfolio polish:** diagrams, extra quality checks, security review.

## Known bugs / limitations

- No live-deployment validation in this repo; templates are compile- and lint-checked only.
  Deployment against a real subscription is left to the learner (and flagged as billable).
- Mission 001's CLI scripts are tested against a fake `az`. `cleanup.sh`'s "already absent"
  matching (`not found`, `does not exist`, …) hasn't been checked against live Azure output.
  A mismatch shows up as a `FAILED` line, not a hidden error.
- Dashboard not implemented; progress is tracked in [PROGRESS.md](PROGRESS.md).

## Planned fixes / next up

- Capture real `az` error output for missing objects (lock, RG, policy, role) from a live
  subscription and add it to `tests/fake_az.sh`, so the cleanup matching is checked against
  real text.

- Build Mission 002 and Mission 010 using Mission 001 as the pattern.
- Add `az deployment ... what-if` transcripts captured from a real subscription as expected-output
  fixtures (optional, learner-provided).
