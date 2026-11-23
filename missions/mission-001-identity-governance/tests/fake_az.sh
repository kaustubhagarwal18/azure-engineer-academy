#!/usr/bin/env bash
# Fake Azure CLI for testing the Mission 001 scripts without Azure, network, or cost.
#
# The test suite puts this on PATH as `az`. Every call is appended to "$FAKE_AZ_LOG" so tests can
# assert what was (and was not) called. Behaviour is selected with FAKE_AZ_MODE:
#
#   good          a correctly deployed landing zone; every command succeeds
#   misconfigured resources exist but with wrong settings (validate.sh must FAIL them)
#   logged-out    `az account show` fails, as when nobody has run `az login`
#   assign-fails  `az role assignment create` always fails (replication never catches up)
#   assign-flaky  `az role assignment create` fails twice, then succeeds
#   partial       only some objects exist; deletes of missing objects report "not found"
#   delete-denied the policy-definition delete fails with AuthorizationFailed
set -uo pipefail

SUB="11111111-1111-1111-1111-111111111111"
PID="22222222-2222-2222-2222-222222222222"
RG="rg-academy-governance"
RG_SCOPE="/subscriptions/${SUB}/resourceGroups/${RG}"
MODE="${FAKE_AZ_MODE:-good}"
ARGS="$*"

echo "${ARGS}" >> "${FAKE_AZ_LOG:?FAKE_AZ_LOG must be set by the test}"

# count_calls "<pattern>" — how many logged calls (including this one) contain the pattern.
count_calls() { grep -cF -- "$1" "${FAKE_AZ_LOG}"; }

# not_found "<what>" — mimic the Azure CLI's error for a missing object and fail.
not_found() { echo "ERROR: (ResourceNotFound) The ${1} could not be found." >&2; exit 3; }

case "${ARGS}" in
  "account show"*)
    [ "${MODE}" = "logged-out" ] && { echo "ERROR: Please run 'az login' to setup account." >&2; exit 1; }
    echo "${SUB}" ;;

  # ---- deploy.sh ---------------------------------------------------------------------------
  "group create"*|"identity create"*|"role definition create"*|"role definition update"*) ;;
  "policy definition create"*|"policy assignment create"*|"lock create"*) ;;
  "role definition list"*'--query [0].roleName'*) ;;  # role not created yet -> create path
  "role assignment create"*)
    case "${MODE}" in
      assign-fails)
        echo "ERROR: (PrincipalNotFound) Principal ${PID} does not exist in the directory." >&2
        exit 1 ;;
      assign-flaky)
        if [ "$(count_calls "role assignment create")" -lt 3 ]; then
          echo "ERROR: (PrincipalNotFound) Principal ${PID} does not exist in the directory." >&2
          exit 1
        fi ;;
    esac ;;

  # ---- shared reads ------------------------------------------------------------------------
  "identity show"*)
    [ "${MODE}" = "partial" ] && not_found "identity"
    echo "${PID}" ;;

  # ---- validate.sh -------------------------------------------------------------------------
  "group show"*'--query name'*)        echo "${RG}" ;;
  "group show"*'--query tags.costCenter'*)
    if [ "${MODE}" = "misconfigured" ]; then echo "finance"; else echo "platform-engineering"; fi ;;
  "role definition list"*'permissions[0].actions'*)
    if [ "${MODE}" = "misconfigured" ]; then
      echo '["*","Microsoft.Resources/tags/write"]'
    else
      echo '["*/read","Microsoft.Resources/tags/write","Microsoft.Resources/tags/delete"]'
    fi ;;
  "role definition list"*'assignableScopes'*)
    if [ "${MODE}" = "misconfigured" ]; then
      echo "[\"${RG_SCOPE}\"]"
    else
      echo "[\"/subscriptions/${SUB}\"]"
    fi ;;
  "role assignment list"*'.principalId'*)        echo "${PID}" ;;
  "role assignment list"*'.roleDefinitionName'*) echo "Platform Tag Operator (dev)" ;;
  "role assignment list"*'.scope'*)
    if [ "${MODE}" = "misconfigured" ]; then echo "/subscriptions/${SUB}"; else echo "${RG_SCOPE}"; fi ;;
  "policy definition show"*'policyRule.then.effect'*)
    if [ "${MODE}" = "misconfigured" ]; then echo "audit"; else echo "deny"; fi ;;
  "policy definition show"*'--query policyRule'*)
    echo '{"if":{"allOf":[{"field":"type","equals":"Microsoft.Resources/subscriptions/resourceGroups"},{"field":"tags[costCenter]","exists":"false"}]},"then":{"effect":"deny"}}' ;;
  "policy assignment show"*'--query scope'*)    echo "/subscriptions/${SUB}" ;;
  "policy assignment show"*'--query enforcementMode'*)
    if [ "${MODE}" = "misconfigured" ]; then echo "DoNotEnforce"; else echo "Default"; fi ;;
  "lock show"*)
    if [ "${MODE}" = "misconfigured" ]; then echo "ReadOnly"; else echo "CanNotDelete"; fi ;;

  # ---- cleanup.sh --------------------------------------------------------------------------
  "lock delete"*|"group delete"*)
    [ "${MODE}" = "partial" ] && not_found "resource group '${RG}'"
    : ;;
  "role assignment delete"*|"policy assignment delete"*|"role definition delete"*) ;;
  "policy definition delete"*)
    if [ "${MODE}" = "delete-denied" ]; then
      echo "ERROR: (AuthorizationFailed) The client does not have authorization to perform action 'Microsoft.Authorization/policyDefinitions/delete'." >&2
      exit 1
    fi
    [ "${MODE}" = "partial" ] && not_found "policy definition"
    : ;;

  *)
    echo "fake az: unhandled call: az ${ARGS}" >&2
    exit 99 ;;
esac
