#!/usr/bin/env bash
# Mission 001 — imperative (Azure CLI) equivalent of bicep/main.bicep.
#
# Creates a governed landing zone: resource group + tags, custom RBAC role, user-assigned
# managed identity, role assignment, a CanNotDelete lock, and a tag-enforcement policy.
#
# Prerequisites: `az login` done, and a subscription selected (`az account set -s <id>`).
# The signed-in principal needs Owner, or Contributor + User Access Administrator, because
# this creates a custom role and a role assignment.
#
# This script is idempotent where the CLI allows it: re-running updates rather than duplicates.
# Override any value with an environment variable, e.g.  LOCATION=northeurope ./deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=_common.sh
. "${SCRIPT_DIR}/_common.sh"

validate_config
require_login

echo "Deploying into subscription ${SUBSCRIPTION_ID} in ${LOCATION}"

echo "==> 1/6 Resource group (with costCenter tag)"
az group create \
  --name "${RG_NAME}" \
  --location "${LOCATION}" \
  --tags "costCenter=${COST_CENTER}" "environment=${ENVIRONMENT}" "managedBy=cli" \
         "mission=m001-identity-governance" \
  --output none

echo "==> 2/6 User-assigned managed identity"
az identity create \
  --name "${IDENTITY_NAME}" \
  --resource-group "${RG_NAME}" \
  --location "${LOCATION}" \
  --output none
PRINCIPAL_ID="$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" \
  --query principalId -o tsv)"
echo "    identity principalId: ${PRINCIPAL_ID}"

echo "==> 3/6 Custom role definition: ${ROLE_NAME}"
ROLE_DEF_JSON="$(cat <<JSON
{
  "Name": "${ROLE_NAME}",
  "Description": "Read all resources and manage tags; cannot create or delete resources.",
  "Actions": [
    "*/read",
    "Microsoft.Resources/tags/write",
    "Microsoft.Resources/tags/delete"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": ["/subscriptions/${SUBSCRIPTION_ID}"]
}
JSON
)"
if az role definition list --name "${ROLE_NAME}" --query "[0].roleName" -o tsv | grep -q .; then
  az role definition update --role-definition "${ROLE_DEF_JSON}" --output none
else
  az role definition create --role-definition "${ROLE_DEF_JSON}" --output none
fi

echo "==> 4/6 Role assignment (custom role -> identity, scoped to the resource group)"
# A brand-new identity's principalId can lag in Entra replication, so retry a few times.
# We capture stderr (rather than discarding it) so a genuine failure is reported, not hidden.
ASSIGN_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}"
MAX_ATTEMPTS=5
assign_err=""
assigned=false
for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  if assign_err="$(az role assignment create \
      --assignee-object-id "${PRINCIPAL_ID}" \
      --assignee-principal-type ServicePrincipal \
      --role "${ROLE_NAME}" \
      --scope "${ASSIGN_SCOPE}" \
      --output none 2>&1)"; then
    echo "    assigned"
    assigned=true
    break
  fi
  if [ "${attempt}" -lt "${MAX_ATTEMPTS}" ]; then
    echo "    attempt ${attempt}/${MAX_ATTEMPTS} failed; principal may still be replicating, waiting 15s..."
    sleep 15
  fi
done
if [ "${assigned}" != true ]; then
  echo "ERROR: role assignment failed after ${MAX_ATTEMPTS} attempts." >&2
  echo "Last Azure CLI error:" >&2
  echo "${assign_err}" >&2
  exit 1
fi

echo "==> 5/6 Custom policy definition + assignment (deny RG without costCenter tag)"
POLICY_RULE_JSON="$(cat <<'JSON'
{
  "if": {
    "allOf": [
      { "field": "type", "equals": "Microsoft.Resources/subscriptions/resourceGroups" },
      { "field": "tags[costCenter]", "exists": "false" }
    ]
  },
  "then": { "effect": "deny" }
}
JSON
)"
az policy definition create \
  --name "${POLICY_DEF_NAME}" \
  --display-name "Require costCenter tag on resource groups" \
  --description "Denies creation of a resource group that has no costCenter tag." \
  --mode All \
  --rules "${POLICY_RULE_JSON}" \
  --output none
az policy assignment create \
  --name "${POLICY_ASSIGN_NAME}" \
  --display-name "Require costCenter tag on resource groups" \
  --policy "${POLICY_DEF_NAME}" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}" \
  --output none

echo "==> 6/6 CanNotDelete lock on the resource group"
az lock create \
  --name "${LOCK_NAME}" \
  --lock-type CanNotDelete \
  --resource-group "${RG_NAME}" \
  --notes "Remove before intentional teardown (see cleanup.sh)." \
  --output none

echo "Done. Validate with ./validate.sh"
