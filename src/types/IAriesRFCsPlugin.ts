import { IPluginMethodMap, IAgentContext, IDIDManager, IResolver } from '@veramo/core'

/**
 * My Agent Plugin description.
 *
 * This is the interface that describes what your plugin can do.
 * The methods listed here, will be directly available to the veramo agent where your plugin is going to be used.
 * Depending on the agent configuration, other agent plugins, as well as the application where the agent is used
 * will be able to call these methods.
 *
 * To build a schema for your plugin using standard tools, you must link to this file in your package.json.
 * Example:
 * ```
 * "veramo": {
 *    "pluginInterfaces": {
 *      "IMyAgentPlugin": "./src/types/IMyAgentPlugin.ts"
 *    }
 *  },
 * ```
 *
 * @beta
 */

export enum MESSAGE_TYPES_0453 {
  PROPOSE_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/propose-credential',
  OFFER_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/offer-credential',
  REQUEST_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/request-credential',
  ISSUE_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/issue-credential',
  PROBLEM_REPORT = 'https://didcomm.org/issue-credential/2.1/problem_report',
  COMPLETE = 'https://didcomm.org/issue-credential/2.1/complete',
}

export enum MESSAGE_TYPES_0454 {
  PROPOSE_PRESENTATION = 'https://didcomm.org/present-proof/2.2/propose-presentation',
  REQUEST_PRESENTATION = 'https://didcomm.org/present-proof/2.2/request-presentation',
  PRESENTATION = 'https://didcomm.org/present-proof/2.2/presentation',
  PROBLEM_REPORT = 'https://didcomm.org/present-proof/2.2/problem_report',
  ACK = 'https://didcomm.org/notification/1.0/ack',
}

export interface IAriesRFCsPlugin extends IPluginMethodMap {
  /**
   * Your plugin method description
   *
   * @param args - Input parameters for this method
   * @param context - The required context where this method can run.
   *   Declaring a context type here lets other developers know which other plugins
   *   need to also be installed for this method to work.
   */
  send0023(args: Send0023MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
  send0453(args: Send0453MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
  send0454(args: Send0454MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
}

interface SendMessageAttr {
  from: string
  to: string
}

export interface Send0023MessageAttr extends SendMessageAttr {}
export interface Send0453MessageAttr extends SendMessageAttr {
  type: MESSAGE_TYPES_0453
  message: {
    '@type': MESSAGE_TYPES_0453
    [key: string]: string
  }
  packingType: DIDCommMessagePacking
}

export interface Send0454MessageAttr extends SendMessageAttr {
  type: MESSAGE_TYPES_0454
  message: {
    '@type': MESSAGE_TYPES_0454
    [key: string]: string
  }
  packingType: DIDCommMessagePacking
}

/**
 * Arguments needed for {@link MyAgentPlugin.myPluginFoo}
 * To be able to export a plugin schema, your plugin methods should use an `args` parameter of a
 * named type or interface.
 *
 * @beta
 */
export interface IMyAgentPluginFooArgs {
  /**
   * Decentralized identifier
   */
  did: string

  /**
   * Lorem ipsum
   */
  bar: string

  /**
   * Dolorem
   */
  foo: string
}

/**
 * Result of {@link MyAgentPlugin.myPluginFoo}
 * To be able to export a plugin schema, your plugin return types need to be Promises of a
 * named type or interface.
 *
 * @beta
 */
export type IMyAgentPluginFooResult = {
  foobar?: string
  baz?: any
}

/**
 * Result of {@link AriesRFCsPlugin.[send_Messages]}
 * To be able to export a plugin schema, your plugin return types need to be Promises of a
 * named type or interface.
 *
 * @beta
 */
export type SendRFCsResponse = {
  threadId: string
  protocolState: string
}

export enum DIDCommMessagePacking {
  NONE = 'none',
  JWS = 'jws',
  AUTHCRYPT = 'authcrypt',
}

/**
 * This context describes the requirements of this plugin.
 * For this plugin to function properly, the agent needs to also have other plugins installed that implement the
 * interfaces declared here.
 * You can also define requirements on a more granular level, for each plugin method or event handler of your plugin.
 *
 * @beta
 */
export type IRequiredContext = IAgentContext<IResolver & IDIDManager>
