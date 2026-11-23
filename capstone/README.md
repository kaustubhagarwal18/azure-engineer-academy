# Capstone — Azure DevOps application platform

The capstone is the thread that ties the missions together. You do **not** build it all at
once. Each week you completed adds the layer you just learned, until you have a coherent,
governed, observable platform deployed entirely from Bicep and GitHub Actions.

## Target end state

An Azure-hosted platform that a small DevOps team could actually run:

- **Governance** (Week 1): a resource-group layout with tags, a custom RBAC role, a
  tag-enforcement Azure Policy, resource locks on anything stateful, and a managed identity the
  automation uses instead of secrets.
- **Storage** (Week 2): a storage account for artefacts and state, correct redundancy and
  access tier, SAS/networking locked down.
- **Compute** (Week 3): Linux VMs and/or a scale set and/or App Service running the app, built
  for availability.
- **Networking** (Week 4): a VNet with subnets and NSGs, Bastion for admin access (no public
  SSH), and private endpoints to the storage account.
- **Observability** (Week 5): Log Analytics, Azure Monitor metrics/logs, alerts to an action
  group, diagnostic settings on every resource, and a backup policy.
- **Automation**: everything above deployed via Bicep modules and a GitHub Actions pipeline
  using OIDC federation to a user-assigned managed identity (no stored credentials).

## How it grows

| After week | Capstone gains | Source missions |
|------------|----------------|-----------------|
| 1 | Governance layer + managed identity | M001 (+ M002, M003) |
| 2 | Storage layer | M010, M011 |
| 3 | Compute layer | M020–M022 |
| 4 | Networking layer, private access | M030, M031 |
| 5 | Monitoring, alerts, backup | M040, M041 |

## Design principles

- **Least privilege** everywhere; prefer managed identities to secrets.
- **No secrets in source**; use Key Vault references and OIDC.
- **Secure defaults**; public access off unless a mission deliberately opens it.
- **Every billable resource is documented** with a cleanup path.
- **Modular Bicep**: each layer is a reusable module composed by a top-level deployment.

## Status

⬜ Not yet assembled. Mission 001 delivers the first governance pieces; the capstone deployment
template is added once enough layers exist to make it meaningful. Until then, follow
[ROADMAP.md](../ROADMAP.md).
