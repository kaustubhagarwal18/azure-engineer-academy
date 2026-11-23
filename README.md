# Azure Engineer Academy

> A hands-on, mentor-driven lab for learning real Azure engineering while preparing for the
> **Microsoft AZ-104** (Azure Administrator) certification. You learn by building,
> breaking, and fixing infrastructure — not by watching videos.

<!-- RESULT IMAGE: add a screenshot of the learning dashboard here once Phase 3 is built.
     Suggested: docs/images/dashboard.png -->
_A learning dashboard screenshot will live here once the dashboard (Phase 3) is built._

![AZ-104](https://img.shields.io/badge/exam-AZ--104-0078D4)
![Bicep](https://img.shields.io/badge/Bicep-0.49.2-blue)
![ShellCheck](https://img.shields.io/badge/ShellCheck-0.11.0-blue)
![IaC](https://img.shields.io/badge/IaC-CLI%20%2B%20Bicep-success)
![CI](https://img.shields.io/badge/CI-validate--bicep%20%2B%20validate--shell-informational)
![License](https://img.shields.io/badge/license-MIT-green)

## What this is

Each **mission** is a realistic platform-engineering scenario mapped to a specific AZ-104
objective. Every mission gives you both an **Azure CLI** and a **Bicep** implementation of the
same infrastructure, so you learn the imperative and declarative paths and when to use each.
Missions come in three difficulty tracks — **Guided**, **Independent**, and **Production
Incident** — and build toward a capstone: an Azure-hosted DevOps application platform.

This repo is written for an experienced engineer. It translates existing Linux, networking,
CI/CD, and observability knowledge into Azure services rather than teaching fundamentals from
scratch.

## Quick start

You need the Azure CLI and the Bicep CLI. Compilation and linting of the templates need
**no Azure account and cost nothing**. Actually deploying resources needs a subscription and
may be billable — every mission flags that and ships a cleanup script.

Install the tools (macOS):

```sh
brew install azure-cli
az bicep install
```

Or install the Bicep CLI standalone without the Azure CLI (Apple Silicon):

```sh
curl -sSL -o bicep https://github.com/Azure/bicep/releases/download/v0.49.2/bicep-osx-arm64
chmod +x bicep
mkdir -p ~/.local/bin && mv bicep ~/.local/bin/bicep
```

Validate a mission's Bicep locally (no Azure login needed):

```sh
bicep build missions/mission-001-identity-governance/bicep/main.bicep --stdout > /dev/null
bicep lint missions/mission-001-identity-governance/bicep/main.bicep
bicep build-params missions/mission-001-identity-governance/bicep/main.bicepparam --stdout > /dev/null
```

To deploy, use the parameter file (it names its template, so there's no `--template-file`).
This **creates real resources in your subscription**; Mission 001's are free, but run its
cleanup script afterwards:

```sh
cd missions/mission-001-identity-governance/bicep
az deployment sub what-if --location westeurope --parameters main.bicepparam
az deployment sub create --location westeurope --parameters main.bicepparam
```

Then open [missions/mission-001-identity-governance/README.md](missions/mission-001-identity-governance/README.md)
and start the Guided track.

## Repository layout

| Path | Purpose |
|------|---------|
| [ROADMAP.md](ROADMAP.md) | The five AZ-104 domains, mission list, and status |
| [PROGRESS.md](PROGRESS.md) | Your personal learning log and achievements |
| [docs/mission-template.md](docs/mission-template.md) | The structure every mission follows |
| [docs/architecture.md](docs/architecture.md) | Platform + capstone architecture and data flow |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [missions/](missions/) | The missions themselves (CLI + Bicep + exercises) |
| [assessments/](assessments/) | Per-week exam-style assessments |
| [capstone/](capstone/) | The evolving capstone platform spec |

## How to work through a mission

1. Read the scenario and short theory.
2. Attempt each task yourself first — the CLI and Bicep you'd write.
3. Reveal the solution (collapsed in each mission) only after an honest attempt.
4. Run the validation commands and compare against expected output.
5. Work the troubleshooting and exam questions.
6. Record your result in [PROGRESS.md](PROGRESS.md).

## Development

Everything below runs offline, with no Azure login and no cost. Install ShellCheck with
`brew install shellcheck`.

```sh
bicep build <path-to>.bicep --stdout > /dev/null
bicep lint <path-to>.bicep
bicep build-params <path-to>.bicepparam --stdout > /dev/null
shellcheck -x $(git ls-files '*.sh')
for f in $(git ls-files '*.sh'); do bash -n "$f" || echo "syntax error: $f"; done
missions/mission-001-identity-governance/tests/test_cli.sh
```

The mission test suites run the real CLI scripts against a fake `az`
([tests/fake_az.sh](missions/mission-001-identity-governance/tests/fake_az.sh)), so they check
exit codes, error messages and which Azure calls are made without touching Azure.

CI on pull requests and pushes to `main`. Tool versions are pinned and their downloads
checked against a SHA-256; each failure is annotated on the file and listed in the job summary.

| Workflow | Job | What it checks |
|---|---|---|
| [validate-bicep](.github/workflows/validate-bicep.yml) | `validate` | Bicep 0.49.2: `bicep build` + `bicep lint` on every `.bicep`, and `bicep build-params` on every `.bicepparam` |
| [validate-shell](.github/workflows/validate-shell.yml) | `shellcheck` | ShellCheck 0.11.0 (`-x`) on every tracked `.sh` file |
| | `syntax` | `bash -n` on every tracked `.sh` file |
| | `tests` | every `missions/*/tests/test_*.sh` suite (fake `az`, offline) |

Each workflow only runs when its own file types change (paths filters). To upgrade a tool,
change its version **and** its SHA-256 in the workflow, and update the badge above.

## Known issues / status

- **Phase 3 dashboard not built yet.** Progress tracking is file-based ([PROGRESS.md](PROGRESS.md))
  for now. See [ROADMAP.md](ROADMAP.md).
- **Only Mission 001 is complete.** It is the reference implementation; Weeks 2–5 are planned.
- Bicep templates are compiled and linted locally and in CI, but **not deployed** against a
  live subscription in this repo. Deploy against your own subscription at your own cost.
- The CLI scripts are tested against a **fake** `az`, not the real Azure CLI. The fake's
  responses and error texts are modelled on the CLI's documented behaviour. In particular,
  `cleanup.sh` decides that an object is "already absent" by matching messages like
  `not found` / `does not exist`, and that matching hasn't been checked against live Azure
  output. If a real "absent" error doesn't match, cleanup reports it as `FAILED` (the safe
  direction) instead of hiding it.

## License

MIT — see [LICENSE](LICENSE).
