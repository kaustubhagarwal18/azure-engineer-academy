#!/usr/bin/env bash
# Mission 001 — verify the governed landing zone exists and is configured as expected.
# Read-only: makes no changes. Prints a PASS/FAIL line per check and exits non-zero on any FAIL.
set -euo pipefail

RG_NAME="${RG_NAME:-rg-academy-governance}"
IDENTITY_NAME="${IDENTITY_NAME:-id-platform-automation}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
ROLE_NAME="Platform Tag Operator (${ENVIRONMENT})"
POLICY_ASSIGN_NAME="require-costcenter-tag"
LOCK_NAME="donotdelete-governance-rg"

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
rc=0

check() {
  # check "<label>" "<value-or-empty>"
  if [ -n "${2:-}" ]; then
    echo "PASS  $1"
  else
    echo "FAIL  $1"
    rc=1
  fi
}

echo "Validating Mission 001 in subscription ${SUBSCRIPTION_ID}"

check "Resource group ${RG_NAME} exists" \
  "$(az group show --name "${RG_NAME}" --query name -o tsv 2>/dev/null || true)"

check "costCenter tag present on RG" \
  "$(az group show --name "${RG_NAME}" --query "tags.costCenter" -o tsv 2>/dev/null || true)"

check "Managed identity ${IDENTITY_NAME} exists" \
  "$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" \
       --query principalId -o tsv 2>/dev/null || true)"

check "Custom role '${ROLE_NAME}' exists" \
  "$(az role definition list --name "${ROLE_NAME}" --query "[0].roleName" -o tsv 2>/dev/null || true)"

PRINCIPAL_ID="$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" \
  --query principalId -o tsv 2>/dev/null || true)"
check "Role assignment for the identity on the RG exists" \
  "$(az role assignment list \
       --assignee "${PRINCIPAL_ID:-00000000-0000-0000-0000-000000000000}" \
       --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}" \
       --query "[0].id" -o tsv 2>/dev/null || true)"

check "Policy assignment ${POLICY_ASSIGN_NAME} exists" \
  "$(az policy assignment show --name "${POLICY_ASSIGN_NAME}" \
       --scope "/subscriptions/${SUBSCRIPTION_ID}" --query name -o tsv 2>/dev/null || true)"

check "CanNotDelete lock ${LOCK_NAME} present" \
  "$(az lock show --name "${LOCK_NAME}" --resource-group "${RG_NAME}" \
       --query name -o tsv 2>/dev/null || true)"

echo ""
if [ "${rc}" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed. Re-run ./deploy.sh or inspect the resources in the portal."
fi
exit "${rc}"
