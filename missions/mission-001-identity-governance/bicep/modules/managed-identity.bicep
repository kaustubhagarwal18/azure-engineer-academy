// User-assigned managed identity, created inside a resource group.
// Platform automation (CI/CD, scripts) authenticates as this identity instead of using secrets.

@description('Azure region for the managed identity.')
param location string

@description('Name of the user-assigned managed identity.')
param identityName string

@description('Tags applied to the identity.')
param tags object = {}

resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

@description('Principal (object) ID used in role assignments.')
output principalId string = uami.properties.principalId

@description('Client ID used by applications to request tokens.')
output clientId string = uami.properties.clientId

@description('Full resource ID of the managed identity.')
output resourceId string = uami.id
