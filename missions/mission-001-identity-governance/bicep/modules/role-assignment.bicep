// Assigns a role to a principal at the scope this module is deployed to (a resource group).
// The assignment name is a deterministic GUID so re-deployment is idempotent.

@description('Principal (object) ID to grant the role to.')
param principalId string

@description('Full resource ID of the role definition to assign (built-in or custom).')
param roleDefinitionId string

@description('Type of the principal. Use ServicePrincipal for managed identities.')
@allowed([
  'ServicePrincipal'
  'User'
  'Group'
])
param principalType string = 'ServicePrincipal'

var assignmentName = guid(resourceGroup().id, principalId, roleDefinitionId)

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: assignmentName
  properties: {
    principalId: principalId
    roleDefinitionId: roleDefinitionId
    principalType: principalType
  }
}

@description('Full resource ID of the created role assignment.')
output roleAssignmentId string = roleAssignment.id
