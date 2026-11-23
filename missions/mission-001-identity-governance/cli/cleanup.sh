#!/usr/bin/env bash
# Mission 001 — tear everything down so nothing keeps costing money or cluttering the tenant.
#
# Order matters: the CanNotDelete lock must go first, then the resource-group contents, then
# the subscription-scoped policy and the custom role (which cannot be deleted while assigned).
#
# Pass --yes to skip the confirmation prompt (e.g. in automation):  ./cleanup.sh --yes
set -euo pipefail

RG_NAME="${RG_NAME:-rg-academy-governance}"
IDENTITY_NAME="${IDENTITY_NAME:-id-platform-automation}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
ROLE_NAME="Platform Tag Operator (${ENVIRONMENT})"
POLICY_DEF_NAME="require-costcenter-tag-on-rg"
POLICY_ASSIGN_NAME="require-costcenter-tag"
LOCK_NAME="donotdelete-governance-rg"

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"

if [ "${1:-}" != "--yes" ]; then
  echo "This will delete resource group '${RG_NAME}' and the Mission 001 governance objects"
  echo "in subscription ${SUBSCRIPTION_ID}."
  printf "Type 'delete' to continue: "
  read -r reply
  if [ "${reply}" != "delete" ]; then
    echo "Aborted."
    exit 0
  fi
fi

echo "==> Removing the CanNotDelete lock (if present)"
az lock delete --name "${LOCK_NAME}" --resource-group "${RG_NAME}" --output none 2>/dev/null || true

echo "==> Removing the role assignment (if present)"
PRINCIPAL_ID="$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" \
  --query principalId -o tsv 2>/dev/null || true)"
if [ -n "${PRINCIPAL_ID}" ]; then
  az role assignment delete \
    --assignee "${PRINCIPAL_ID}" \
    --role "${ROLE_NAME}" \
    --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}" \
    --output none 2>/dev/null || true
fi

echo "==> Deleting the resource group (identity included). This runs in the background."
az group delete --name "${RG_NAME}" --yes --no-wait --output none 2>/dev/null || true

echo "==> Removing the policy assignment and definition"
az policy assignment delete --name "${POLICY_ASSIGN_NAME}" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}" --output none 2>/dev/null || true
az policy definition delete --name "${POLICY_DEF_NAME}" --output none 2>/dev/null || true

echo "==> Removing the custom role definition"
# A role cannot be deleted while assignments remain; the assignment above was removed first.
az role definition delete --name "${ROLE_NAME}" --output none 2>/dev/null || true

echo "Cleanup initiated. The resource-group deletion finishes asynchronously; confirm with:"
echo "  az group exists --name ${RG_NAME}"
