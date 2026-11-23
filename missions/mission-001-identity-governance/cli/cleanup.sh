#!/usr/bin/env bash
# Mission 001 — tear everything down so nothing keeps costing money or cluttering the tenant.
#
# Order matters: the CanNotDelete lock must go first, then the role assignment, then the
# resource group, then the subscription-scoped policy and the custom role (which cannot be
# deleted while it is still assigned).
#
# Safe on a partial deployment: anything already absent is reported as "skip", not an error.
# Any other failure is printed with the Azure CLI's own message, and the script exits non-zero.
#
# Pass --yes to skip the confirmation prompt (e.g. in automation):  ./cleanup.sh --yes
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=_common.sh
. "${SCRIPT_DIR}/_common.sh"

validate_config
require_login

if [ "${1:-}" != "--yes" ]; then
  echo "This will delete resource group '${RG_NAME}' and the Mission 001 governance objects"
  echo "in subscription ${SUBSCRIPTION_ID}."
  printf "Type 'delete' to continue: "
  reply=""
  read -r reply || true
  if [ "${reply}" != "delete" ]; then
    echo "Aborted. Nothing was changed."
    exit 0
  fi
fi

failures=0

# try_delete "<label>" <command...> — run one teardown step and classify the outcome:
#   ok      the object was deleted (or deletion was accepted);
#   skip    the object was already absent, which is fine on a partial deployment;
#   FAILED  anything else — the CLI's error is printed and the failure is counted.
try_delete() {
  local label="$1"
  shift
  local out
  if out="$("$@" 2>&1)"; then
    echo "  ok      ${label}"
  elif printf '%s' "${out}" | grep -Eqi "not ?found|could not be found|does(n't| not) exist|no matched assignments"; then
    echo "  skip    ${label} (already absent)"
  else
    echo "  FAILED  ${label}" >&2
    printf '%s\n' "${out}" | sed 's/^/          /' >&2
    failures=$((failures + 1))
  fi
}

echo "==> 1/5 CanNotDelete lock"
try_delete "lock ${LOCK_NAME}" \
  az lock delete --name "${LOCK_NAME}" --resource-group "${RG_NAME}" --output none

echo "==> 2/5 Role assignment"
PRINCIPAL_ID="$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" \
  --query principalId -o tsv 2>/dev/null || true)"
if [ -n "${PRINCIPAL_ID}" ]; then
  try_delete "role assignment '${ROLE_NAME}' -> ${IDENTITY_NAME}" \
    az role assignment delete \
      --assignee "${PRINCIPAL_ID}" \
      --role "${ROLE_NAME}" \
      --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}" \
      --output none
else
  echo "  skip    role assignment (identity ${IDENTITY_NAME} not found, so no assignment to remove)"
fi

echo "==> 3/5 Resource group (identity included; deletion continues in the background)"
try_delete "resource group ${RG_NAME}" \
  az group delete --name "${RG_NAME}" --yes --no-wait --output none

echo "==> 4/5 Policy assignment and definition"
try_delete "policy assignment ${POLICY_ASSIGN_NAME}" \
  az policy assignment delete --name "${POLICY_ASSIGN_NAME}" \
    --scope "/subscriptions/${SUBSCRIPTION_ID}" --output none
try_delete "policy definition ${POLICY_DEF_NAME}" \
  az policy definition delete --name "${POLICY_DEF_NAME}" --output none

echo "==> 5/5 Custom role definition"
# A role cannot be deleted while assignments remain; step 2 removed ours first.
try_delete "custom role '${ROLE_NAME}'" \
  az role definition delete --name "${ROLE_NAME}" --output none

echo ""
if [ "${failures}" -eq 0 ]; then
  echo "Cleanup complete. The resource-group deletion finishes asynchronously; confirm with:"
  echo "  az group exists --name ${RG_NAME}"
else
  echo "Cleanup finished with ${failures} failure(s) — see FAILED lines above." >&2
  echo "Fix the cause (often permissions, or a lock added by someone else), then re-run ./cleanup.sh." >&2
  exit 1
fi
