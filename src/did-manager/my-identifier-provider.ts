import { IIdentifier, IKey, IService, IAgentContext, IKeyManager, DIDDocument } from '@veramo/core-types'
import { AbstractIdentifierProvider } from '@veramo/did-manager'

type IContext = IAgentContext<IKeyManager>

/**
 * You can use this template for an `AbstractIdentifierProvider` implementation.
 *
 * Implementations of this interface are used by `@veramo/did-manager` to implement
 * CRUD operations for various DID methods.
 *
 * If you wish to implement support for a particular DID method, this is the type of class
 * you need to implement.
 *
 * If you don't want to customize this, then it is safe to remove from the template.
 *
 * @alpha
 */
export class MyIdentifierProvider extends AbstractIdentifierProvider {
  private defaultKms: string

  constructor(options: { defaultKms: string }) {
    super()
    this.defaultKms = options.defaultKms
  }

  async createIdentifier(
    { kms, alias }: { kms?: string; alias?: string },
    context: IContext
  ): Promise<Omit<IIdentifier, 'provider'>> {
    throw new Error('not_implemented: createIdentifier')
  }

  async deleteIdentifier(identity: IIdentifier, context: IContext): Promise<boolean> {
    throw new Error('not_implemented: deleteIdentifier')
  }

  async addKey(
    { identifier, key, options }: { identifier: IIdentifier; key: IKey; options?: any },
    context: IContext
  ): Promise<any> {
    throw new Error('not_implemented: addKey')
  }

  async addService(
    { identifier, service, options }: { identifier: IIdentifier; service: IService; options?: any },
    context: IContext
  ): Promise<any> {
    throw new Error('not_implemented: addService')
  }

  async removeKey(args: { identifier: IIdentifier; kid: string; options?: any }, context: IContext): Promise<any> {
    throw new Error('not_implemented: removeKey')
  }

  async removeService(args: { identifier: IIdentifier; id: string; options?: any }, context: IContext): Promise<any> {
    throw new Error('not_implemented: removeService')
  }

  updateIdentifier?(args: { did: string; document: Partial<DIDDocument>; options?: { [x: string]: any } }, context: IContext): Promise<IIdentifier> {
    throw new Error('not_implemented: updateIdentifier')
  }
}
