import {
  ICredentialIssuer,
  IDataStore,
  IDataStoreORM,
  IDIDManager,
  IKeyManager,
  IMessageHandler,
  IResolver,
} from '@veramo/core-types'

export type VeramoAgent = IDIDManager &
  IKeyManager &
  IDataStore &
  IDataStoreORM &
  IResolver &
  ICredentialIssuer &
  IMessageHandler
