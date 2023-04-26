import { IPluginMethodMap, IAgentContext } from '@veramo/core'
import { DIDCommMessagePacking } from '@veramo/did-comm'
import { VeramoAgent } from './VeramoAgent'

/**
 * Message types for the O453 present proof ARIES flow
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

/**
 * Message types for the O454 present proof ARIES flow
 * 
 * @beta
 */
export enum MESSAGE_TYPES_0454 {
  PROPOSE_PRESENTATION = 'https://didcomm.org/present-proof/2.2/propose-presentation',
  REQUEST_PRESENTATION = 'https://didcomm.org/present-proof/2.2/request-presentation',
  PRESENTATION = 'https://didcomm.org/present-proof/2.2/presentation',
  PROBLEM_REPORT = 'https://didcomm.org/present-proof/2.2/problem_report',
  ACK = 'https://didcomm.org/notification/1.0/ack',
}

/**
 * Plugin implementation of Aries RFC flows to allow sending of DIDCOMM messages as defined in the spec
 * 
 * @beta
 */
export interface IAriesRFCsPlugin extends IPluginMethodMap {
  /**
   * Your plugin method description
   *
   * @param args - Input parameters for this method
   * @param context - The required context where this method can run.
   *   Declaring a context type here lets other developers know which other plugins
   *   need to also be installed for this method to work.
   * @returns The response of this function
   */
  send0023(args: Send0023MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>

  /**
   * Your plugin method description
   *
   * @param args - Input parameters for this method
   * @param context - The required context where this method can run.
   *   Declaring a context type here lets other developers know which other plugins
   *   need to also be installed for this method to work.
   * @returns The response of this function
   */
  send0453(args: Send0453MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>

  /**
   * Your plugin method description
   *
   * @param args - Input parameters for this method
   * @param context - The required context where this method can run.
   *   Declaring a context type here lets other developers know which other plugins
   *   need to also be installed for this method to work.
   * @returns The response of this function
   */
  send0454(args: Send0454MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse>
}


/**
 * Generic type of messages
 * 
 * @beta
 */
interface SendMessageAttr {
  /**
   * The sender of the message or initiator of the protocol
   */
  from: string
  /**
   * The receiver of the first message 
   */
  to: string
}

/**
 * @beta
 */
export interface Send0023MessageAttr extends SendMessageAttr {}

/**
 * @beta
 */
export interface Send0453MessageAttr extends SendMessageAttr {
  /**
   * The type of message
   * {@link MESSAGE_TYPES_0453}
   */
  type: MESSAGE_TYPES_0453

  message: {
    '@type': MESSAGE_TYPES_0453
    /**
     * Other attributes of the message
     */
    [key: string]: string | number | Object
  }
  packingType: DIDCommMessagePacking
}

/**
 * @beta
 */
export interface Send0454MessageAttr extends SendMessageAttr {
  /**
   * The type of message
   * {@link MESSAGE_TYPES_0453}
   */
  type: MESSAGE_TYPES_0454

  message: {
    '@type': MESSAGE_TYPES_0454

    /**
     * Other attributes of the message
     */
    [key: string]: string | number | Object
  }
  packingType: DIDCommMessagePacking
}


/**
 * Result of {@link AriesRFCsPlugin.[send_Messages]}
 * This is the result type of sending an RFC message or initiating an RFC protocol successfully
 *
 * @beta
 */
export type SendRFCsResponse = {
  
  /**
   * The thread ID for the initiated protocol (exchange)
   */
  threadId: string

  /**
   * The state of the protocol after initiated
   */
  protocolState: string
}


/**
 * This context describes the requirements of this plugin.
 * For this plugin to function properly, the agent needs to also have other plugins installed that implement the
 * interfaces declared here.
 *
 * @beta
 */
export type IRequiredContext = IAgentContext<VeramoAgent>
