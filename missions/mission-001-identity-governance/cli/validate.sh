#!/usr/bin/env bash
# Mission 001 — verify the governed landing zone is not just present but *configured correctly*.
#
# Read-only: makes no changes. Each check compares the live value against what the mission
# requires and prints PASS/FAIL, showing expected vs actual on failure. Exits non-zero on any FAIL.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=_common.sh
. "${SCRIPT_DIR}/_common.sh"

validate_config
require_login

rc=0
SUB_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"
RG_SCOPE="${SUB_SCOPE}/resourceGroups/${RG_NAME}"

# pass / fail — record one check result; fail flips the overall exit code.
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; rc=1; }

# check_present "<label>" "<value>" — PASS when the value is non-empty.
check_present() {
  if [ -n "${2:-}" ]; then pass "$1"; else fail "$1 (not found)"; fi
}

# check_eq "<label>" "<expected>" "<actual>" — PASS when actual equals expected exactly.
check_eq() {
  if [ "$2" = "${3:-}" ]; then
    pass "$1"
  else
    fail "$1 (expected '$2', got '${3:-<empty>}')"
  fi
}

# check_contains "<label>" "<needle>" "<haystack>" — PASS when the haystack contains the needle.
check_contains() {
  case "${3:-}" in
    *"$2"*) pass "$1" ;;
    *) fail "$1 (expected to contain '$2', got '${3:-<empty>}')" ;;
  esac
}

# q <az args...> — run a read-only az query; print its value, or nothing if the object is absent.
# stderr is dropped here on purpose: login was already verified by require_login, so a failing
# query means "object missing or misconfigured", and the FAIL line reports expected vs actual.
q() { az "$@" 2>/dev/null || true; }

echo "Validating Mission 001 in subscription ${SUBSCRIPTION_ID}"
echo ""
echo "-- Resource group"
check_eq "Resource group ${RG_NAME} exists" \
  "${RG_NAME}" "$(q group show --name "${RG_NAME}" --query name -o tsv)"
check_eq "RG costCenter tag = ${COST_CENTER}" \
  "${COST_CENTER}" "$(q group show --name "${RG_NAME}" --query "tags.costCenter" -o tsv)"

echo ""
echo "-- Custom role: permissions and assignable scopes"
ROLE_ACTIONS="$(q role definition list --name "${ROLE_NAME}" --query "[0].permissions[0].actions" -o json)"
check_contains "Role grants */read"                          '"*/read"'                          "${ROLE_ACTIONS}"
check_contains "Role grants Microsoft.Resources/tags/write"  '"Microsoft.Resources/tags/write"'  "${ROLE_ACTIONS}"
check_contains "Role grants Microsoft.Resources/tags/delete" '"Microsoft.Resources/tags/delete"' "${ROLE_ACTIONS}"
# Least privilege: the role must NOT grant a wildcard write or delete on all resources.
case "${ROLE_ACTIONS}" in
  *'"*"'*|*'"*/write"'*|*'"*/delete"'*) fail "Role is least-privilege (found a broad * / */write / */delete action)" ;;
  *) pass "Role is least-privilege (no * / */write / */delete action)" ;;
esac
check_contains "Role assignable at the subscription (${SUB_SCOPE})" \
  "\"${SUB_SCOPE}\"" "$(q role definition list --name "${ROLE_NAME}" --query "[0].assignableScopes" -o json)"

echo ""
echo "-- Role assignment: principal, role and scope"
PRINCIPAL_ID="$(q identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" --query principalId -o tsv)"
check_present "Managed identity ${IDENTITY_NAME} has a principalId" "${PRINCIPAL_ID}"
# An all-zero GUID never matches, so an absent identity yields clean FAILs rather than an error.
ASSIGNEE="${PRINCIPAL_ID:-00000000-0000-0000-0000-000000000000}"
RA_FILTER="[?roleDefinitionName=='${ROLE_NAME}']"
check_eq "Assignment principal = identity" \
  "${PRINCIPAL_ID:-<identity missing>}" \
  "$(q role assignment list --assignee "${ASSIGNEE}" --scope "${RG_SCOPE}" --query "${RA_FILTER}.principalId | [0]" -o tsv)"
check_eq "Assignment role = ${ROLE_NAME}" \
  "${ROLE_NAME}" \
  "$(q role assignment list --assignee "${ASSIGNEE}" --scope "${RG_SCOPE}" --query "${RA_FILTER}.roleDefinitionName | [0]" -o tsv)"
check_eq "Assignment scope = resource group (not wider)" \
  "${RG_SCOPE}" \
  "$(q role assignment list --assignee "${ASSIGNEE}" --scope "${RG_SCOPE}" --query "${RA_FILTER}.scope | [0]" -o tsv)"

echo ""
echo "-- Policy definition: rule and effect"
POLICY_RULE="$(q policy definition show --name "${POLICY_DEF_NAME}" --query policyRule -o json)"
check_eq "Policy effect = deny" \
  "deny" "$(q policy definition show --name "${POLICY_DEF_NAME}" --query "policyRule.then.effect" -o tsv)"
check_contains "Policy targets resource groups" \
  'Microsoft.Resources/subscriptions/resourceGroups' "${POLICY_RULE}"
check_contains "Policy checks the costCenter tag" \
  'tags[costCenter]' "${POLICY_RULE}"

echo ""
echo "-- Policy assignment: scope and enforcement mode"
check_eq "Policy assignment scope = subscription" \
  "${SUB_SCOPE}" \
  "$(q policy assignment show --name "${POLICY_ASSIGN_NAME}" --scope "${SUB_SCOPE}" --query scope -o tsv)"
check_eq "Policy assignment enforcement mode = Default (enforced)" \
  "Default" \
  "$(q policy assignment show --name "${POLICY_ASSIGN_NAME}" --scope "${SUB_SCOPE}" --query enforcementMode -o tsv)"

echo ""
echo "-- Resource lock"
check_eq "Lock ${LOCK_NAME} level = CanNotDelete" \
  "CanNotDelete" "$(q lock show --name "${LOCK_NAME}" --resource-group "${RG_NAME}" --query level -o tsv)"

echo ""
if [ "${rc}" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed. Each FAIL shows expected vs actual. Re-run ./deploy.sh or fix the resource, then re-validate."
fi
exit "${rc}"
