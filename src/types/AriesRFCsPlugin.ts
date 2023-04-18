import { IPluginMethodMap, IAgentContext, IDIDManager, IResolver } from '@veramo/core-types'

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
export interface AriesRFCsPlugin extends IPluginMethodMap {
  /**
   * Your plugin method description
   *
   * @param args - Input parameters for this method
   * @param context - The required context where this method can run.
   *   Declaring a context type here lets other developers know which other plugins
   *   need to also be installed for this method to work.
   */
  send0023(args: send0023MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
  send0453(args: send0453MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
  send0454(args: send0454MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
}

interface sendMessageAttr{
    from: string;
    to: string;
}

interface send0023MessageAttr extends sendMessageAttr{}
interface send0453MessageAttr extends sendMessageAttr{
    type: string;
    message: {
        '@type': string,
        [key: string]: string
    }
}

interface send0454MessageAttr extends sendMessageAttr{
    type: string;
    message: {
        '@type': string,
        [key: string]: string
    }
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

/**
 * This context describes the requirements of this plugin.
 * For this plugin to function properly, the agent needs to also have other plugins installed that implement the
 * interfaces declared here.
 * You can also define requirements on a more granular level, for each plugin method or event handler of your plugin.
 *
 * @beta
 */
export type IRequiredContext = IAgentContext<IResolver & IDIDManager>
