import {
  ICredentialIssuer,
  IDataStore,
  IDataStoreORM,
  IDIDManager,
  IKeyManager,
  IMessageHandler,
  IResolver,
  IAgentContext
} from '@veramo/core'
import {IDIDComm } from '@veramo/did-comm'

/**
 * Veramo plugins used by this plugin.
 * @beta
 */
export type VeramoAgent = IDIDManager &
IKeyManager &
IDataStore &
IDataStoreORM &
IResolver &
ICredentialIssuer &
IMessageHandler &
IDIDComm;

export type IContext = IAgentContext<VeramoAgent>

