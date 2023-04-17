import { IKey, ManagedKeyInfo } from '@veramo/core-types'
import { AbstractKeyStore, AbstractPrivateKeyStore, ManagedPrivateKey } from '@veramo/key-manager'
import { ImportablePrivateKey } from '@veramo/key-manager'

/**
 * This type of class would allow you to define your own storage for the key mappings that a Veramo agent manages.
 * `@veramo/key-manager` can be configured with a class like this to customize the way it stores key metadata.
 *
 * If you don't want to customize this, then it is safe to remove from the template.
 *
 * @alpha
 */
export class MyKeyStore extends AbstractKeyStore {
  async importKey(args: IKey): Promise<boolean> {
    throw new Error('not_implemented: MyKeyStore.importKey')
  }

  async getKey({ kid }: { kid: string }): Promise<IKey> {
    throw new Error('not_implemented: MyKeyStore.getKey')
  }

  async deleteKey({ kid }: { kid: string }): Promise<boolean> {
    throw new Error('not_implemented: MyKeyStore.deleteKey')
  }

  async listKeys(args: {}): Promise<ManagedKeyInfo[]> {
    throw new Error('not_implemented: MyKeyStore.listKeys')
  }
}

/**
 * This type of class would allow you to define **your own storage for the key material** that the default Veramo
 * AbstractKeyManagementSystem implementation uses.
 * `@veramo/kms-local` can be configured with a class like this to customize the way it stores key material.
 *
 * If you don't want to customize this, then it is safe to remove from the template.
 *
 * @alpha
 */
export class MyPrivateKeyStore extends AbstractPrivateKeyStore {
  importKey(args: ImportablePrivateKey): Promise<ManagedPrivateKey> {
    throw new Error('not_implemented: MyPrivateKeyStore.importKey')
  }

  getKey(args: { alias: string }): Promise<ManagedPrivateKey> {
    throw new Error('not_implemented: MyPrivateKeyStore.getKey')
  }

  deleteKey(args: { alias: string }): Promise<boolean> {
    throw new Error('not_implemented: MyPrivateKeyStore.deleteKey')
  }

  listKeys(args: {}): Promise<ManagedPrivateKey[]> {
    throw new Error('not_implemented: MyPrivateKeyStore.listKeys')
  }

}
