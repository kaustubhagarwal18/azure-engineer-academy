#!/usr/bin/env bash
# Shared configuration and helpers for the Mission 001 scripts (deploy / validate / cleanup).
#
# This file is *sourced*, not executed. It only defines variables and functions — it performs
# no Azure calls and has no side effects until a function is called. Every script sources it,
# so configuration and its validation live in exactly one place.

# die "<message>" — print a one-line, human-readable error to stderr and stop with a non-zero exit.
die() {
  echo "ERROR: $*" >&2
  exit 1
}

# Configuration. Override any value with an environment variable, e.g. LOCATION=northeurope ./deploy.sh
# `${VAR-default}` (no colon) applies the default only when VAR is *unset*. A variable that is set
# but empty — usually a typo like LOCATION=$UNSET_VAR — is kept and then rejected by validate_config.
LOCATION="${LOCATION-westeurope}"
RG_NAME="${RG_NAME-rg-academy-governance}"
IDENTITY_NAME="${IDENTITY_NAME-id-platform-automation}"
COST_CENTER="${COST_CENTER-platform-engineering}"
ENVIRONMENT="${ENVIRONMENT-dev}"

# Fixed names used by the sourcing scripts. ShellCheck lints this file on its own and cannot see
# those uses, so SC2034 ("appears unused") is a false positive for this block only.
# shellcheck disable=SC2034
{
  ROLE_NAME="Platform Tag Operator (${ENVIRONMENT})"
  POLICY_DEF_NAME="require-costcenter-tag-on-rg"
  POLICY_ASSIGN_NAME="require-costcenter-tag"
  LOCK_NAME="donotdelete-governance-rg"
}

# Set by require_login(); declared here so callers can rely on it existing.
SUBSCRIPTION_ID=""

# validate_config — fail safely on invalid environment-variable configuration, before any Azure call.
validate_config() {
  [ -n "${LOCATION}" ]      || die "LOCATION must not be empty. Example: LOCATION=northeurope ./deploy.sh"
  [ -n "${RG_NAME}" ]       || die "RG_NAME must not be empty."
  [ -n "${IDENTITY_NAME}" ] || die "IDENTITY_NAME must not be empty."
  [ -n "${COST_CENTER}" ]   || die "COST_CENTER must not be empty — it is the value of the tag the policy enforces."

  # ENVIRONMENT is used in the custom role name and must match the Bicep @allowed values.
  case "${ENVIRONMENT}" in
    dev|test|prod) ;;
    *) die "ENVIRONMENT must be one of: dev, test, prod (got '${ENVIRONMENT}'). This matches the Bicep @allowed values and the custom role name." ;;
  esac

  # Resource group names: letters, digits, '.', '_', '-', '(', ')'; 1-90 characters.
  if ! printf '%s' "${RG_NAME}" | grep -Eq '^[A-Za-z0-9._()-]{1,90}$'; then
    die "RG_NAME '${RG_NAME}' is not a valid resource group name (allowed: letters, digits, . _ - ( ); up to 90 chars)."
  fi

  # User-assigned managed identity names: letters, digits, '-', '_'; 3-128 characters.
  if ! printf '%s' "${IDENTITY_NAME}" | grep -Eq '^[A-Za-z0-9_-]{3,128}$'; then
    die "IDENTITY_NAME '${IDENTITY_NAME}' is not a valid managed-identity name (allowed: letters, digits, - _; 3-128 chars)."
  fi
}

# require_login — ensure the Azure CLI is installed and logged in, and set SUBSCRIPTION_ID.
# Runs in the current shell (not a subshell) so die() stops the whole script on failure.
require_login() {
  command -v az >/dev/null 2>&1 \
    || die "Azure CLI 'az' not found. Install it: https://learn.microsoft.com/cli/azure/install-azure-cli"
  SUBSCRIPTION_ID="$(az account show --query id -o tsv 2>/dev/null || true)"
  [ -n "${SUBSCRIPTION_ID}" ] \
    || die "Not logged in to Azure, or no subscription selected. Run: az login && az account set -s <subscription-id>"
}
