import { TKeyType, IKey, ManagedKeyInfo, MinimalImportableKey } from '@veramo/core-types'
import { AbstractKeyManagementSystem } from '@veramo/key-manager'

/**
 * You can use this template for an `AbstractKeyManagementSystem` implementation.
 * Key Management Systems are the bridge between key material and the cryptographic operations that can be performed
 * with it.
 *
 * This interface is used by `@veramo/key-manager` to delegate cryptographic operations to the actual implementation.
 * Veramo can use multiple key management systems at the same time, and if you wish to add your own
 * you need to implement a class like this.
 *
 * If you don't want to customize this, then it is safe to remove this file from the template.
 *
 * @alpha
 */
export class MyKeyManagementSystem extends AbstractKeyManagementSystem {
  /**
   * Sign the `data` using the `algorithm` and the key referenced by `keyRef`.
   */
  async sign(args: { keyRef: Pick<IKey, 'kid'>; algorithm?: string | undefined; data: Uint8Array }): Promise<string> {
    throw new Error('not_implemented: MyKeyManagementSystem.sign')
  }

  /**
   * Compute a shared secret between `theirKey` (public) and `myKey` (secret)
   * `myKeyRef` is used to reference the key managed by this key management system.
   * @param args
   */
  async sharedSecret(args: { myKeyRef: Pick<IKey, 'kid'>; theirKey: Pick<IKey, 'type' | 'publicKeyHex'> }): Promise<string> {
    throw new Error('not_implemented: MyKeyManagementSystem.sharedSecret')
  }

  /**
   * Import a `privateKeyHex` of type `type`.
   * This method MUST create a `ManagedKeyInfo` by deriving the corresponding `publicKeyHex`,
   *  and generating a key ID (`kid`) (or using the one provided).
   *
   * The `kid` will be used by Veramo to reference this key later for cryptographic operations (`sign()` &
   * `sharedSecret()`).
   *
   * It is the responsibility of the key management system to store keys.
   *
   * @param args
   */
  async importKey(args: MinimalImportableKey): Promise<ManagedKeyInfo> {
    throw new Error('not_implemented: MyKeyManagementSystem.importKey')
  }

  async listKeys(): Promise<ManagedKeyInfo[]> {
    throw new Error('not_implemented: MyKeyManagementSystem.listKeys')
  }

  async createKey({ type, meta }: { type: TKeyType; meta?: any }): Promise<ManagedKeyInfo> {
    let key: ManagedKeyInfo

    switch (type) {
      case 'Ed25519':
        throw Error('not_implemented: MyKeyManagementSystem createKey Ed25519 not implemented')
        break
      case 'Secp256k1':
        throw Error('not_implemented: MyKeyManagementSystem createKey Secp256k1 not implemented')
        break
      case 'X25519':
        throw Error('not_implemented: MyKeyManagementSystem createKey X25519 not implemented')
        break
      default:
        throw Error('not_implemented: Key type not supported by MyKeyManagementSystem: ' + type)
    }
    return key
  }

  async deleteKey(args: { kid: string }): Promise<boolean> {
    throw Error('not_implemented: KeyManagementSystem.deleteKey')
  }
}
