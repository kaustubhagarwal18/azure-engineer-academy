#!/usr/bin/env bash
# Behavioural tests for the Mission 001 CLI scripts, using a fake `az` (tests/fake_az.sh).
#
# No Azure account, network, or cost: the real deploy/validate/cleanup scripts run unchanged,
# but every `az` call hits the fake. Run from anywhere:  ./tests/test_cli.sh
set -uo pipefail

TESTS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd -- "${TESTS_DIR}/../cli" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# Fake `az`, plus a no-op `sleep` so the retry loop runs instantly.
mkdir -p "${WORK}/bin"
ln -s "${TESTS_DIR}/fake_az.sh" "${WORK}/bin/az"
printf '#!/usr/bin/env bash\nexit 0\n' > "${WORK}/bin/sleep"
chmod +x "${WORK}/bin/sleep" "${TESTS_DIR}/fake_az.sh"

passed=0
failed=0
OUT=""   # combined stdout+stderr of the last run
RC=0     # exit code of the last run

# run <mode> <script> [args...] — run a script against the fake az with a clean config env.
# Extra VAR=value pairs can be given via the RUN_ENV array before calling.
run() {
  local mode="$1" script="$2"
  shift 2
  : > "${WORK}/az.log"
  OUT="$(env -i HOME="${HOME}" PATH="${WORK}/bin:/usr/bin:/bin" \
    FAKE_AZ_MODE="${mode}" FAKE_AZ_LOG="${WORK}/az.log" "${RUN_ENV[@]+"${RUN_ENV[@]}"}" \
    bash "${CLI_DIR}/${script}" "$@" < "${STDIN_FILE:-/dev/null}" 2>&1)"
  RC=$?
  RUN_ENV=()
  STDIN_FILE=""
}

# ok "<test name>" <condition...> — record PASS when the condition command succeeds.
ok() {
  local name="$1"
  shift
  if "$@"; then
    passed=$((passed + 1))
    echo "  ok    ${name}"
  else
    failed=$((failed + 1))
    echo "  FAIL  ${name}"
    while IFS= read -r line; do echo "        | ${line}"; done <<< "${OUT}"
  fi
}

# has "<text>" — the last run's output contains the text.
has() { [[ "${OUT}" == *"$1"* ]]; }
# lacks "<text>" — the last run's output does not contain the text.
lacks() { [[ "${OUT}" != *"$1"* ]]; }
# rc_is <n> — the last run exited with code n.
rc_is() { [ "${RC}" -eq "$1" ]; }
# called <n> "<pattern>" — the fake az saw exactly n calls containing the pattern.
called() { [ "$(grep -cF -- "$2" "${WORK}/az.log")" -eq "$1" ]; }
# no_az_calls — the script made no az calls at all.
no_az_calls() { [ ! -s "${WORK}/az.log" ]; }

RUN_ENV=()
STDIN_FILE=""

echo "Configuration validation"
for bad in "ENVIRONMENT=staging" "ENVIRONMENT=" "LOCATION=" "COST_CENTER=" \
           "RG_NAME=bad name!" "RG_NAME=" "IDENTITY_NAME=x" "IDENTITY_NAME=has space"; do
  for script in deploy.sh validate.sh cleanup.sh; do
    RUN_ENV=("${bad}"); run good "${script}" --yes
    ok "${script} rejects '${bad}' before any az call" \
      eval 'rc_is 1 && has "ERROR:" && no_az_calls'
  done
done

echo "Login check"
run logged-out deploy.sh
ok "deploy.sh stops with a login hint when not logged in" \
  eval 'rc_is 1 && has "az login" && called 0 "group create"'

echo "Role-assignment retry loop"
run assign-fails deploy.sh
ok "deploy.sh exits non-zero when every assignment attempt fails" eval 'rc_is 1'
ok "deploy.sh tries exactly 5 times" called 5 "role assignment create"
ok "deploy.sh reports the attempt count" has "role assignment failed after 5 attempts"
ok "deploy.sh preserves the Azure CLI error text" has "PrincipalNotFound"
ok "deploy.sh stops before the policy and lock steps" \
  eval 'called 0 "policy definition create" && called 0 "lock create"'

run assign-flaky deploy.sh
ok "deploy.sh succeeds when replication catches up on attempt 3" \
  eval 'rc_is 0 && called 3 "role assignment create" && called 1 "lock create"'

run good deploy.sh
ok "deploy.sh succeeds first time on a healthy tenant" \
  eval 'rc_is 0 && called 1 "role assignment create" && has "Done."'

echo "Validation of actual configuration"
run good validate.sh
ok "validate.sh passes a correctly configured landing zone" \
  eval 'rc_is 0 && lacks "FAIL" && has "All checks passed."'

run misconfigured validate.sh
ok "validate.sh exits non-zero on misconfiguration" eval 'rc_is 1'
ok "validate.sh catches the wrong tag value"        has "FAIL  RG costCenter tag = platform-engineering (expected 'platform-engineering', got 'finance')"
ok "validate.sh catches a non-least-privilege role" has "FAIL  Role is least-privilege"
ok "validate.sh catches a missing role action"      has "FAIL  Role grants */read"
ok "validate.sh catches the wrong assignable scope" has "FAIL  Role assignable at the subscription"
ok "validate.sh catches an over-wide assignment"    has "FAIL  Assignment scope = resource group (not wider)"
ok "validate.sh catches the audit effect"           has "FAIL  Policy effect = deny (expected 'deny', got 'audit')"
ok "validate.sh catches DoNotEnforce"               has "got 'DoNotEnforce'"
ok "validate.sh catches the wrong lock level"       has "got 'ReadOnly'"

echo "Cleanup"
run partial cleanup.sh --yes
ok "cleanup.sh tolerates a partial deployment" eval 'rc_is 0 && has "skip" && lacks "FAILED"'
ok "cleanup.sh skips the role assignment when the identity is gone" \
  eval 'has "identity id-platform-automation not found" && called 0 "role assignment delete"'

run delete-denied cleanup.sh --yes
ok "cleanup.sh exits non-zero when a delete is denied" eval 'rc_is 1'
ok "cleanup.sh shows the Azure CLI error for the failure" has "AuthorizationFailed"
ok "cleanup.sh still attempts the steps after the failure" called 1 "role definition delete"

printf 'no\n' > "${WORK}/answer"
STDIN_FILE="${WORK}/answer"; run good cleanup.sh
ok "cleanup.sh aborts when the answer is not 'delete'" \
  eval 'rc_is 0 && has "Aborted" && called 0 "delete"'

run good cleanup.sh
ok "cleanup.sh aborts on end-of-input (no stdin)" eval 'rc_is 0 && has "Aborted" && called 0 "delete"'

echo ""
echo "${passed} passed, ${failed} failed"
[ "${failed}" -eq 0 ]
