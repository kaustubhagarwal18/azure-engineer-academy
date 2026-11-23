// Mission 001 — Governed landing zone foundations (subscription-scoped).
//
// Deploys, in one declarative template:
//   1. a resource group carrying a mandatory costCenter tag;
//   2. a custom RBAC role (read all + manage tags, no delete);
//   3. a user-assigned managed identity inside that resource group;
//   4. a role assignment granting the custom role to the identity, scoped to the RG;
//   5. a CanNotDelete lock on the resource group;
//   6. a custom Azure Policy that denies resource groups without a costCenter tag, plus its
//      subscription-scope assignment.
//
// Deploy with the parameter file (it names this template via `using`, so no --template-file):
//   az deployment sub create --location westeurope --parameters main.bicepparam
// Requires the deploying principal to have Owner or (Contributor + User Access Administrator),
// because it creates a custom role and a role assignment.

targetScope = 'subscription'

@description('Azure region for region-bound resources and the deployment metadata.')
param location string = 'westeurope'

@description('Resource group to create for the governed landing zone.')
param resourceGroupName string = 'rg-academy-governance'

@description('Name of the user-assigned managed identity used by platform automation.')
param identityName string = 'id-platform-automation'

@description('Value for the mandatory costCenter tag enforced by policy.')
param costCenter string = 'platform-engineering'

@description('Deployment environment, applied as a tag and used in the custom role name.')
@allowed([
  'dev'
  'test'
  'prod'
])
param environment string = 'dev'

var baseTags = {
  costCenter: costCenter
  environment: environment
  managedBy: 'bicep'
  mission: 'm001-identity-governance'
}

// 1) Resource group. Carries the costCenter tag the policy below requires.
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: baseTags
}

// 2) Custom RBAC role: read everything and manage tags, but cannot create or delete resources.
//    assignableScopes limits where the role may be assigned.
resource tagOperator 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(subscription().id, 'platform-tag-operator')
  properties: {
    roleName: 'Platform Tag Operator (${environment})'
    description: 'Read all resources and manage tags; cannot create or delete resources.'
    type: 'CustomRole'
    permissions: [
      {
        actions: [
          '*/read'
          'Microsoft.Resources/tags/write'
          'Microsoft.Resources/tags/delete'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
    assignableScopes: [
      subscription().id
    ]
  }
}

// 3) User-assigned managed identity, created inside the resource group.
module identity 'modules/managed-identity.bicep' = {
  name: 'deploy-managed-identity'
  scope: rg
  params: {
    location: location
    identityName: identityName
    tags: baseTags
  }
}

// 4) Grant the custom role to the managed identity, scoped to the resource group.
module tagOperatorAssignment 'modules/role-assignment.bicep' = {
  name: 'assign-tag-operator'
  scope: rg
  params: {
    principalId: identity.outputs.principalId
    roleDefinitionId: tagOperator.id
    principalType: 'ServicePrincipal'
  }
}

// 5) Protect the resource group from accidental deletion (via a module, because the lock is
//    deployed at the resource-group scope while this file is subscription-scoped).
module rgLock 'modules/rg-lock.bicep' = {
  name: 'lock-governance-rg'
  scope: rg
  params: {
    lockName: 'donotdelete-governance-rg'
    level: 'CanNotDelete'
    notes: 'Governance landing zone. Remove this lock before intentional teardown (see cleanup.sh).'
  }
}

// 6) Custom policy: deny a resource group that has no costCenter tag.
resource requireCostCenter 'Microsoft.Authorization/policyDefinitions@2021-06-01' = {
  name: 'require-costcenter-tag-on-rg'
  properties: {
    policyType: 'Custom'
    mode: 'All'
    displayName: 'Require costCenter tag on resource groups'
    description: 'Denies creation of a resource group that has no costCenter tag.'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Resources/subscriptions/resourceGroups'
          }
          {
            field: 'tags[costCenter]'
            exists: 'false'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

// Assign the policy at the subscription scope.
resource requireCostCenterAssignment 'Microsoft.Authorization/policyAssignments@2022-06-01' = {
  name: 'require-costcenter-tag'
  properties: {
    displayName: 'Require costCenter tag on resource groups'
    policyDefinitionId: requireCostCenter.id
    enforcementMode: 'Default'
  }
}

output resourceGroupId string = rg.id
output managedIdentityPrincipalId string = identity.outputs.principalId
output managedIdentityClientId string = identity.outputs.clientId
output customRoleId string = tagOperator.id
output policyAssignmentId string = requireCostCenterAssignment.id
