// Places a management lock on the resource group this module is deployed to.
// A CanNotDelete lock lets people read and modify resources but blocks deletion of the RG
// and everything in it until the lock is removed.

@description('Lock name.')
param lockName string = 'donotdelete-rg'

@description('Lock level.')
@allowed([
  'CanNotDelete'
  'ReadOnly'
])
param level string = 'CanNotDelete'

@description('Why the lock exists and how to remove it.')
param notes string = ''

resource lock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: lockName
  properties: {
    level: level
    notes: notes
  }
}

@description('Full resource ID of the lock.')
output lockId string = lock.id
