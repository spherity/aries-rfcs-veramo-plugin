import { IIdentifier } from '@veramo/core-types'
import { AbstractDIDStore } from '@veramo/did-manager'

/**
 * This type of class allows you to define your own storage for the DIDs that a Veramo agent manages.
 * `@veramo/did-manager` can be configured with a class like this to customize DID storage.
 *
 * Storing a DID means keeping a record of the keys and services associated with the DID that this agent controls.
 * Veramo DID providers use the `controllerKeyId` property to manage CRUD operations for the DID and its corresponding
 * DID document. In most cases, the `controllerKeyId` refers to a `kid` property of a `ManagedKeyInfo`, but this is not
 * mandatory.
 *
 * If you don't want to customize this, then it is safe to remove from the template.
 *
 * @alpha
 */
export class MyDIDStore extends AbstractDIDStore {

  importDID(args: IIdentifier): Promise<boolean> {
    throw new Error("not_implemented: importDID")
  }

  getDID(args: { did: string } | { alias: string; provider: string }): Promise<IIdentifier> {
    throw new Error("not_implemented: getDID")
  }

  async deleteDID(args: { did: string }): Promise<boolean> {
    throw new Error("not_implemented: deleteDID")
  }

  listDIDs(args: { alias?: string; provider?: string }): Promise<IIdentifier[]> {
    throw new Error("not_implemented: listDIDs")
  }
}
