import { IAgentPlugin } from '@veramo/core'
import { randomUUID } from 'crypto'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import {
  ChildMachineState_Invitation,
  DidExchange0023MessageHandler,
  MachineState_0023,
  Transition_0023,
} from './handlers/0023-did-exchange.handler'
import {
  ChildMachineState_Offer,
  ChildMachineState_Proposal,
  ChildMachineState_Request,
  IssueCredential0453MessageHandler,
  MachineState_0453,
  Transition_0453,
} from './handlers/0453-issue-credential-v2.handler'
import {
  MachineState_0454,
  PresentProof0454MessageHandler,
  Transition_0454,
} from './handlers/0454-present-proof-v2.handler'
import {
  IAriesRFCsPlugin,
  IRequiredContext,
  MESSAGE_TYPES_0453,
  MESSAGE_TYPES_0454,
  Send0023MessageAttr,
  Send0453MessageAttr,
  Send0454MessageAttr,
  SendRFCsResponse,
} from './types/IAriesRFCsPlugin'

// !!!!! DO THE SCHEMA FOR THE PLUGIN

/**
 * {@inheritDoc IMyAgentPlugin}
 * @beta
 */
export class AriesRFCsPlugin implements IAgentPlugin {
  // readonly schema = schema.IMyAgentPlugin

  // map the methods your plugin is declaring to their implementation
  readonly methods: IAriesRFCsPlugin = {
    send0023: this.send0023.bind(this),
    send0453: this.send0453.bind(this),
    send0454: this.send0454.bind(this),
  }

  // list the event types that this plugin cares about.
  // When the agent emits an event of these types, `MyAgentPlugin.onEvent()` will get called.
  readonly eventTypes = ['validatedMessage']

  // the event handler for the types listed in `eventTypes`
  public async onEvent(event: { type: string; data: any }, context: IRequiredContext) {
    // you can emit other events
    await context.agent.emit('my-event', { foo: event.data.id })
    // or call other agent methods that are declared in the context
    const allDIDs = await context.agent.didManagerFind()
  }

  /** {@inheritDoc IMyAgentPlugin.myPluginFoo} */
  private async send0023(args: Send0023MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse> {
    // you can call other agent methods (that are declared in the `IRequiredContext`)
    const protocol0023 = interpret(DidExchange0023MessageHandler.getMachineConfig())
    const threadId = randomUUID()

    try {
      protocol0023.start()
      protocol0023.send({
        type: Transition_0023.SendInvitation,
        fromDid: args.from,
        toDid: args.to,
        threadId: threadId,
        veramoAgent: context.agent,
      })
      await waitFor(
        protocol0023,
        (state) =>
          // Sending an invitations triggers a 'child' machine to handle the two states [sent] and [pending/sending]
          // Waiting for this state means we need to specifically wait to the child state
          state.matches({ [MachineState_0023.InvitationSent]: [ChildMachineState_Invitation.Sent] }),
        { timeout: 20000 }
      )

      return {
        threadId,
        protocolState: Object.values(protocol0023.getSnapshot().value)[0] as any,
      }
    } catch (exception: any) {
      console.error(
        `Failed sending 0023 invitation from [${args.from}] to [${args.to}] with threadId [${threadId}] because of -> ${exception.message}`
      )
      // Javascript error handling ladies and gentlemen
      // The default timeout error is really ambigious, this enriches the message a bit
      if (exception.message.includes('Timeout')) {
        throw new Error(
          'Unable to send message. Invitation was not sent out as protocol did not advance after 10 seconds.'
        )
      }
      // If for any reason the error is not a timeout we still want to throw a 500
      throw new Error(exception)
    } finally {
      protocol0023.stop()
    }
  }

  /** {@inheritDoc IMyAgentPlugin.myPluginFoo} */
  private async send0453(args: Send0453MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse> {
    const protocol0453 = interpret(IssueCredential0453MessageHandler.getMachineConfig())
    const threadId = randomUUID()
    const veramoAgent = context.agent

    // Check for whether we have an exchange with the did we are trying to start issuing flow with.
    const completedMessages = (await veramoAgent.dataStoreORMGetMessages({
      // We only want to retrieve messages that can either be sent to us, or received by us with the type complete
      where: [
        { column: 'to', value: [args.to, args.from] },
        { column: 'from', value: [args.from, args.to] },
        { column: 'type', value: ['https://didcomm.org/didexchange/1.0/complete'] },
      ],
      order: [{ column: 'createdAt', direction: 'DESC' }],
    })) as any

    if (Array.isArray(completedMessages) && completedMessages.length <= 0) {
      throw new Error(`You<${args.from}> have not had a did exchange with the DID<${args.to}>`)
    }

    try {
      protocol0453.start()

      if (args.type === MESSAGE_TYPES_0453.PROPOSE_CREDENTIAL) {
        protocol0453.send({
          type: Transition_0453.SendProposal,
          fromDid: args.from,
          toDid: args.to,
          threadId: threadId,
          veramoAgent: veramoAgent,
        })
        await waitFor(
          protocol0453,
          (state) =>
            // Proposing a credential means the machine will start off in a propose credential flow
            // Waiting for this state means we need to specifically wait for the child state for the proposal to be send
            state.matches({ [MachineState_0453.ProposalSent]: [ChildMachineState_Proposal.Sent] }),
          { timeout: 20000 }
        )
      } else if (args.type === MESSAGE_TYPES_0453.OFFER_CREDENTIAL) {
        protocol0453.send({
          type: Transition_0453.SendOffer,
          fromDid: args.from,
          toDid: args.to,
          threadId: threadId,
          message: args.message,
          veramoAgent: veramoAgent,
        })
        await waitFor(
          protocol0453,
          (state) =>
            // Offering a credential means the machine will start off in an offer credential flow
            // Waiting for this state means we need to specifically wait for the offer to be sent
            state.matches({ [MachineState_0453.OfferSent]: [ChildMachineState_Offer.Sent] }),
          { timeout: 20000 }
        )
      }

      return {
        threadId,
        protocolState: Object.values(protocol0453.getSnapshot().value)[0] as any,
      }
    } catch (exception: any) {
      console.error(
        `Failed sending 0453 issue credential offer from [${args.from}] to [${args.to}] with threadId [${threadId}] because of -> ${exception.message}`
      )

      if (exception.message.includes('Timeout')) {
        throw new Error(
          'Unable to send message. Invitation was not sent out as protocol did not advance after 10 seconds.'
        )
      }

      // If for any reason the error is not a timeout we still want to throw a 500
      throw new Error(exception)
    } finally {
      protocol0453.stop()
    }
  }

  /** {@inheritDoc IMyAgentPlugin.myPluginFoo} */
  private async send0454(args: Send0454MessageAttr, context: IRequiredContext): Promise<SendRFCsResponse> {
    // you can call other agent methods (that are declared in the `IRequiredContext`)
    const protocol0454 = interpret(PresentProof0454MessageHandler.getMachineConfig())
    const threadId = randomUUID()
    const veramoAgent = context.agent

    // Check for whether we have an invitation with the DID we are trying to communicate with
    const messages = (await veramoAgent.dataStoreORMGetMessages({
      // We only want to retrieve messages that are not from ourselves (as in sent by us)
      where: [
        { column: 'to', value: [args.to, args.from] },
        { column: 'from', value: [args.from, args.to] },
        { column: 'type', value: ['https://didcomm.org/didexchange/1.0/complete'] },
      ],
      order: [{ column: 'createdAt', direction: 'DESC' }],
    })) as any

    if (Array.isArray(messages) && messages.length <= 0) {
      throw new Error(`You<${args.from}> have not had a did exchange with the DID<${args.to}>`)
    }

    try {
      protocol0454.start()

      if (args.type === MESSAGE_TYPES_0454.PROPOSE_PRESENTATION) {
        protocol0454.send({
          type: Transition_0454.SendProposal,
          fromDid: args.from,
          toDid: args.to,
          threadId: threadId,
          message: args.message,
          veramoAgent: veramoAgent,
        })
        await waitFor(
          protocol0454,
          (state) =>
            // Sending a PROPOSAL Initiates the machine.
            // Waiting for this state means we need are waiting for the proposal to be sent
            state.matches({ [MachineState_0454.ProposalSent]: [ChildMachineState_Proposal.Sent] }),
          { timeout: 20000 }
        )
      } else if (args.type === MESSAGE_TYPES_0454.REQUEST_PRESENTATION) {
        protocol0454.send({
          type: Transition_0454.SendRequest,
          fromDid: args.from,
          toDid: args.to,
          threadId: threadId,
          message: args.message,
          veramoAgent: veramoAgent,
        })
        await waitFor(
          protocol0454,
          (state) =>
            // Sending an invitations triggers a 'child' machine to handle the two states [sent] and [pending/sending]
            // Waiting for this state means we need to specifically wait to the child state
            state.matches({ [MachineState_0454.RequestSent]: [ChildMachineState_Request.Sent] }),
          { timeout: 20000 }
        )
      }

      return {
        threadId,
        protocolState: Object.values(protocol0454.getSnapshot().value)[0] as any,
      }
    } catch (exception: any) {
      console.error(
        `Failed sending 0454 issue credential offer from [${args.from}] to [${args.to}] with threadId [${threadId}] because of -> ${exception.message}`
      )

      if (exception.message.includes('Timeout')) {
        throw new Error(
          'Unable to send message. Invitation was not sent out as protocol did not advance after 10 seconds.'
        )
      }

      // If for any reason the error is not a timeout we still want to throw a 500
      throw new Error(exception)
    } finally {
      protocol0454.stop()
    }
  }
}
