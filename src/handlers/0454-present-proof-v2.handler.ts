import { AbstractMessageHandler, Message } from '@veramo/message-handler'
import { IAgentContext, IDataStore, IDIDManager, IKeyManager, W3CVerifiableCredential } from '@veramo/core'
import { IDIDComm } from '@veramo/did-comm/src/types/IDIDComm'
import { IDataStoreORM } from '@veramo/data-store'
import { createMachine, interpret, Interpreter, StateMachine } from 'xstate'
import { randomUUID } from 'crypto'
import { waitFor } from 'xstate/lib/waitFor'
import { IDIDCommMessage } from '@veramo/did-comm/src/types/message-types'
import { VeramoAgent } from '../types/VeramoAgent'
import { DIDCommMessagePacking } from '../types/IAriesRFCsPlugin'

type IContext = IAgentContext<IDIDManager & IKeyManager & IDIDComm & IDataStore & IDataStoreORM>

export enum MESSAGE_TYPES_0454 {
  PROPOSE_PRESENTATION = 'https://didcomm.org/present-proof/2.2/propose-presentation',
  REQUEST_PRESENTATION = 'https://didcomm.org/present-proof/2.2/request-presentation',
  PRESENTATION = 'https://didcomm.org/present-proof/2.2/presentation',
  PROBLEM_REPORT = 'https://didcomm.org/present-proof/2.2/problem_report',
  ACK = 'https://didcomm.org/notification/1.0/ack',
}

/*
 * All possible states of the protocol for both sides
 * Some states are 'actionable' meaning that a machine should never stop in them (marked with //actionable)
 * Actionable states will have modeled invocations which either advance, or abandon the thread
 * */
export enum MachineState_0454 {
  Start = 'start',
  RequestSent = 'request-sent',
  RequestReceived = 'request-received', // [2]Actionable because we received a request after an invitation and now need to answer
  ProposalSent = 'proposal-sent',
  ProposalReceived = 'proposal-received',
  PresentationSent = 'presentation-sent',
  PresentationReceived = 'presentation-received',
  Abandoned = 'abandoned',
  ProblemReportSent = 'send-problem-report',
  ProblemReportReceived = 'receive-problem-report',
  ContinueOrSendProblemReport = 'continue-or-send-report',
  AckReceived = 'ack-received',
  Done = 'done',
}

export enum ChildMachineState_Presentation {
  Pending = 'presentationPending',
  Sent = 'presentationSent',
}

export enum ChildMachineState_Proposal {
  Pending = 'proposalPending',
  Sent = 'proposalSent',
}

export enum ChildMachineState_Request {
  Pending = 'requestPending',
  Sent = 'requestSent',
}

export enum Transition_0454 {
  SendProposal = 'Send Proposal',
  SendRequest = 'Send Request',
  ReceiveProposal = 'Receive Proposal',
  ReceiveRequest = 'Receive Request',
  SendPresentation = 'Send Presentation',
  ReceivePresentation = 'Receive Presentation',
  SendAck = 'Send Ack',
  ReceiveAck = 'Receive Ack',
  SendProblemReport = 'Send Problem Report',
  ReceiveProblemReport = 'Receive Problem Report',
}

export enum ErrorCodes_0454 {
  ProblemReport = 'problem-report',
}

const METADATA_AIP_TYPE = 'AIP_RFC'
const METADATA_AIP_STATE_MACHINE = 'AIP_STATE_MACHINE'
const METADATA_AIP_IN_RESPONSE_TO = 'AIP_IN_RESPONSE_TO'
const METADATA_AIP_RECEIVED_MESSAGE = 'AIP_RECEIVED_MESSAGE'

/*
 *                                         (This Handler)
 *                                 ┌───────────────────────────┐
 *                                 │                           │
 * ┌────────────────────┐          │ Check requirements        │
 * │                    │          │                           │
 * │  Receive message   │ ────────►│ Rehydrate state machine   │
 * │                    │          │                           │
 * └────────────────────┘          │ Create message structure  │
 *                                 │                           │
 * ┌────────────────────┐          └────────────────┬──────────┘
 * │                    │                           │
 * │    Send Answer     │ ◄─────────────────────────┘
 * │                    │
 * └────────────────────┘
 *
 */
export class PresentProof0454MessageHandler extends AbstractMessageHandler {
  constructor() {
    super()
  }

  get stateMachineConfiguration(): StateMachine<any, any, any> {
    return this._stateMachineConfiguration
  }

  // Machine for RFC 0453 - Issue Credential V2
  private readonly _stateMachineConfiguration = createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QCUBiBhADAFgKzYDpYAXAQwCdiBiAZTADsIACZMARwFc5iBtTAXUSgADgHtYAS2ITR9ISAAeiAIy5MBAGy4NAJlw6AzAHYdynZhMAaEAE9EagwUzPMygJy43OnQA5l2AwBfQOs0LDxCEgpqVgBjMAkANzAWdi4SPkEkEDFJaVl5JQRlA3UtXX1jU3MrW0RTHwIdbDc3Hx0jVp8jbEwgkJAwnHwiMkpaBmYABXJRXNIAG0z5XKkZOWyi-zLtPUMTMwsdazsEY1wmtUw9NrcDNw0DDWDQjGHIsZiweKSUmbnxItltlVvkNqAtmpNLtKgcasc6ggjD51EYrgYAqUjDhlC9Bm8IgRyGluABaWAML4-ZJMGZwSmkMHAkTiNYFTYqAztAhubY+dq4HxPVQnRAtDROFzeQzYDReHx4oaE4mcMkU+hUhI0-4AIwWYAAtqkxJRmTlWWDCohdKLio8dE0Wnc5ToNFp+q9wiMVeliOTKUSSSQppMJPQoFQILIwAQw4lRABrGNRSgAfXVEFYqoyAhWFvWVoQbmwjR8uFUGhL3QMyhFiN0jjRzlUQrRRmRioJ3qDfuJ1Mgkejsfo8aTgezxDiWsg6cmdPVZDBs8Y-3mS1zIPz7IhYrumk6RhKyNMXlwtr8BCdrTueEw+Dwna9hB9ZL704gVDA5Fm5AIwgWjIAGaiOQBrjr6U6-BAy4QPODJLhmq6AuuWQsnkBYcggLSOBoB5Hu07h6LahiONebQkd0PS4gMSojLEsjSPQXCkiB-qMKSxImtQUb0DGcaJjG9EamGXCpiBMG6vqBqsFxZqghhO7FP4DrtH4bjXNisrIsRJaOteGjOH47ZGB6+JPgQQmMcxrEZhxYBcZ+34gX+AHEMBoEWQxIlgGJ5ASbMeqGjJIG8BuaFsuCigqMpBCqe4Gk4LhPjEc4BA9Ne7QGB0ug6I+7x-sSC6Musdn9h+PF8SOAkFfSGrFbIkHJBAclbpFRQ9I0+AaD4JYaMoKKugYtolHKl7KG6xauN07hGHlhLCIV8ElW+UGOT+LlASBYELbVi7rI1kAteh25RQgOheDyPVctiVx9cow3lo441um6mBtMYjxzd2-akgtoiBQadkORVw6jjGf0A8FlAHc1YXmsdbUqN4Rg8pgujdGWPgGQ8w19Y0L19dcuBGN1xZfYQO1FWCbHcUO-FjpTS2yHQGpHRFha1t0BDKG9vSPD0NbYMN3gSgTuClDzahluTBUArAiw01QB2pBObOWphHUEF1PVY-11yPMLvSXFKWjaNoCo0V2FOzGuivK5JhrGiFasKadmva71euDcNNaNLyuGuPofium4Mt-bbC6y2uIaMGGEYg-TyafP5ctAnD8knUUpSOCiWm+Goqg8xoPtvQQBjl08Nb6GixMy7ZENSUDIWDrxoPVQ3QX2SFLOhah8Ps5hZg85eJ53hWqg9A9JTcwT2Otp9lvmeHyGle+LeVWDUfITDLuZ-YehNOUXJ+PouCeLaDZpVcLbnO2Fuevly-ywsq+rV+63-ptHlP4sO-p61hZT6H20MfVQehz6Ik6BKK41xDAn1rLgYIAx6CiAgHAeQtFsB5gRoWUkxdER4MlC4EwvNKIYjrp8bBA9FLYARKcEmbhNBkX0INO4iDF75RfCQGmVD1aKRMsoS8aNwEeDRMWIwtpyyCKbK4PAN49gyy4X6SOSiY4QDjrw127VOhCIqJ4YmnhsASMRJ4RhegXB+D8AYcss0OHKh7DTcC3Ae6aL3kpEymhzGGEesiLKF9TBaylE6Zw5dsCKIcStJqrjEZnH8JebqPQ1DqWcLhIaiJ3AXGaK0EwBdDC4RlpZbyLFyBsQgE3Sg0TCzqXxiWFo2wz5pNOOYRhV5egNA6BYMOi06rU0iZASpGtjGnH8D0MaAdvAlHMN0cJP0O6A04iFAZikeauFiuYGs7ZrE83uA9YsM83TGDRsTPmXTdr1XoDwzcODB7NjWX0ZQmzyx9DcMLa4+zCY+GSWPLpqcX4LiWW7F56SZpl1CUeJs7ofkRwDD-BYaiNFXOoadMwQykY9VihXM+4p9AeChSvSOsKXGIr4adcW0j+omCyrWFZ+DhlYicEKaxagTJHFsQ-Qk9cAqNwWRU4lWiVC3PaPcx52ygXDKrJoF6Xh1KVg6GEuxIxYWvyiXytx5dGh6GRM9N02AHkPNtG2K+zhBTigxLQmWpAdSkEYNGCAAKtglguHFdscpMBCj6rjN1RqLA8zkWWeV7KRgVXtSoNpjpvC6seJWHmdDOSeEvNebE2TxbdSQYEIAA */
    id: 'RFC0454',
    initial: MachineState_0454.Start,
    context: {
      problemcode: undefined,
    },
    states: {
      // Starting States for the Machine,
      // 1. The Issuer can start by sending the Offer
      // 2. The holder can start by sending a Proposal
      // 3. The holder can start by sending a Request
      [MachineState_0454.Start]: {
        on: {
          [Transition_0454.SendRequest]: {
            target: MachineState_0454.RequestSent,
          },
          [Transition_0454.ReceiveRequest]: {
            target: MachineState_0454.RequestReceived,
          },
          [Transition_0454.SendProposal]: {
            target: MachineState_0454.ProposalSent,
          },
          [Transition_0454.ReceiveProposal]: {
            target: MachineState_0454.ProposalReceived,
          },
        },
      },

      // Request Sent State is a Verifier State
      [MachineState_0454.RequestSent]: {
        initial: ChildMachineState_Request.Pending,
        states: {
          // Sending the request if the children state is Pending
          [ChildMachineState_Request.Pending]: {
            invoke: {
              id: 'start_sendRequest',
              src: async (_, event) => await this.sendRequest(event),
              onDone: {
                target: ChildMachineState_Request.Sent,
              },
            },
          },
          // If the request is sent, then the children state is Sent and Final.
          [ChildMachineState_Request.Sent]: {
            type: 'final',
          },
        },
        // This state can go down 3 routes.
        on: {
          // 1. If issuer receives a Presentation on his request (Receive presentation -> presentation received)
          [Transition_0454.ReceivePresentation]: {
            target: MachineState_0454.PresentationReceived,
          },
          // 2. If issuer receives a problem report on his Offer (Receive Problem Report -> Abandoned)
          [Transition_0454.ReceiveProblemReport]: {
            target: MachineState_0454.ProblemReportReceived,
          },
        },
      },

      [MachineState_0454.RequestReceived]: {
        invoke: {
          id: 'requestReceived_sendPresentation_sendProposal',
          src: async (_, event) => await this.sendPresentation(event),
          onDone: {
            target: MachineState_0454.PresentationSent,
          },
          onError: {
            target: MachineState_0454.ContinueOrSendProblemReport,
          },
        },
      },

      [MachineState_0454.ContinueOrSendProblemReport]: {
        invoke: {
          id: 'continue_or_sendProblemReport',
          src: async (_, _event) =>
            console.log('decide to whether presentation request is something we want to response to or send problem'),
          onDone: {
            target: MachineState_0454.ProposalSent,
          },
          onError: {
            target: MachineState_0454.ProblemReportSent,
          },
        },
      },

      [MachineState_0454.PresentationReceived]: {
        invoke: {
          id: 'presentationReceived',
          src: async (_, event) => await this.receivePresentation(event),
          onDone: {
            target: MachineState_0454.Done,
          },
          onError: {
            target: MachineState_0454.ProblemReportSent,
          },
        },
      },

      [MachineState_0454.ProblemReportReceived]: {
        invoke: {
          id: 'problemReportReceived',
          src: async (_, event) => await this.receiveProblemReport(event),
          onDone: {
            target: MachineState_0454.Abandoned,
          },
        },
      },

      [MachineState_0454.PresentationSent]: {
        invoke: {
          id: 'presentationSent',
          src: async (_, event) => await console.log('presentation sent'),
          onDone: {
            target: MachineState_0454.Done,
          },
        },
        on: {
          [Transition_0454.ReceiveProblemReport]: {
            target: MachineState_0454.ProblemReportReceived,
          },
          [Transition_0454.ReceiveAck]: {
            // TODO: should go to recieved ack state so that we can store the state as done
            target: MachineState_0454.AckReceived,
          },
        },
      },

      [MachineState_0454.AckReceived]: {
        invoke: {
          id: 'ackReceived',
          src: async (_, event) => await this.receiveAck(event),
          onDone: {
            target: MachineState_0454.Done,
          },
        },
      },

      [MachineState_0454.ProposalSent]: {
        initial: ChildMachineState_Proposal.Pending,
        states: {
          // Sending the proposal if the children state is Pending
          [ChildMachineState_Proposal.Pending]: {
            invoke: {
              id: 'start_sendProposal',
              src: async (_, event) => await console.log('send proposal'),
              onDone: {
                target: ChildMachineState_Proposal.Sent,
              },
            },
          },

          // If the Proposal is sent, then the children state is Sent and Final.
          [ChildMachineState_Proposal.Sent]: {
            type: 'final',
          },
        },

        // This state can go down 2 routes.
        on: {
          // 1. If holder receives an Offer (Receive Offer -> Offer Received)
          [Transition_0454.ReceiveRequest]: {
            target: MachineState_0454.PresentationSent,
          },

          // 2. If holder receives a Problem Report on his Offer (Receive Problem Report -> Abandoned)
          [Transition_0454.ReceiveProblemReport]: {
            target: MachineState_0454.ProblemReportReceived,
          },
        },
      },

      [MachineState_0454.ProblemReportSent]: {
        invoke: {
          id: 'problemReportSent',
          src: async (_, event) => await this.sendProblemReport(event),
          onDone: {
            target: MachineState_0454.Abandoned,
          },
        },
      },
      [MachineState_0454.ProposalReceived]: {
        invoke: {
          id: 'proposalReceived',
          src: async (_, event) => await console.log('proposal received, send request'),
          onDone: {
            target: '#RFC0454.request-sent.requestPending',
          },
          onError: {
            target: MachineState_0454.ProblemReportSent,
          },
        },
      },
      [MachineState_0454.Abandoned]: {
        type: 'final',
      },
      [MachineState_0454.Done]: {
        type: 'final',
      },
    },
    schema: {
      events: {} as
        | { type: Transition_0454.SendPresentation }
        | { type: Transition_0454.ReceivePresentation }
        | { type: Transition_0454.SendProposal }
        | { type: Transition_0454.ReceiveProposal }
        | { type: Transition_0454.SendRequest }
        | { type: Transition_0454.ReceiveRequest }
        | { type: Transition_0454.SendProblemReport }
        | { type: Transition_0454.ReceiveProblemReport }
        | { type: Transition_0454.SendAck }
        | { type: Transition_0454.ReceiveAck },
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
  })

  private checkforFinal(_: { problemcode: undefined }) {
    return false
  }

  async handle(message: Message, context: IContext): Promise<Message> {
    // Check if this is actually a message we want to handle
    // If not, we pass the message to the next handler
    //
    // This is the only and last point we can pass the message to the next handler. If we determine this is indeed a message
    // **_this_** handler should handle, we are not passing it to the next one in case of errors.
    if (!Object.values(MESSAGE_TYPES_0454).includes(message.data['@type'])) {
      console.log(
        `Received didcomm message of type: [${message.data['@type']}] which is not handled by PresentProof0454MessageHandler. Passing to next handler.`
      )
      return super.handle(message, context)
    }

    try {
      if (!message.threadId || !message.to || !message.from || !message.id || !message.data) {
        throw new Error(`Incoming aries 0454 message has missing required fields for evaluation [${message}]`)
      }

      console.log(
        `Received didcomm message of type: [${message.data['@type']}] from did [${message.from}] for thread [${message.threadId}]`
      )

      const stateMachineService = interpret(this._stateMachineConfiguration)

      // check if we have stored an abandoned on this thread (recived a problem report)
      const receivedSavedMessages = await context.agent.dataStoreORMGetMessages({
        where: [
          { column: 'threadId', value: [message.threadId] },
          { column: 'from', value: [message.from] },
        ],
        order: [{ column: 'createdAt', direction: 'DESC' }],
      })
      if (receivedSavedMessages && receivedSavedMessages.length !== 0) {
        const lastReceivedMessageInThread = receivedSavedMessages[0] as Message
        if (lastReceivedMessageInThread.metaData) {
          const stateMetadataObj = lastReceivedMessageInThread.metaData.reduce(
            (obj, metaData) => {
              if (metaData.type === METADATA_AIP_RECEIVED_MESSAGE && metaData.value === true.toString()) {
                return { ...obj, received: true }
              }
              if (metaData.type === METADATA_AIP_STATE_MACHINE) {
                return { ...obj, state: metaData.value as MachineState_0454 }
              }
              return obj
            },
            { received: false, state: MachineState_0454.Start } as { received: boolean; state: MachineState_0454 }
          )

          if (
            !!stateMetadataObj &&
            stateMetadataObj['received'] === true &&
            stateMetadataObj['state'] === MachineState_0454.Abandoned
          ) {
            throw new Error(`Communication with the thread [${message.threadId}] is already abandoned start a new flow`)
          }

          if (
            !!stateMetadataObj &&
            stateMetadataObj['received'] === true &&
            stateMetadataObj['state'] === MachineState_0454.Done
          ) {
            throw new Error(`Communication with the thread [${message.threadId}] is already Done start a new flow`)
          }
        }
      }

      const messages = await context.agent.dataStoreORMGetMessages({
        // We only want to retrieve messages that we sent
        where: [
          { column: 'threadId', value: [message.threadId] },
          { column: 'from', value: [message.to] },
        ],
        order: [{ column: 'createdAt', direction: 'DESC' }],
      })

      // In every incoming valid message either one of these scenarios is true:
      // 1. Communication already happened. The thread should then be filled with at least 1 previous message -> We hydrate the machine with the newest message in the thread
      // 2, Communication never has happened before (new invitation). The thread is empty -> We do not hydrate the machine and start it fresh
      if (messages && messages.length !== 0) {
        const lastMessageInThread = messages[0] as Message
        if (lastMessageInThread.metaData) {
          const stateMetadataString = lastMessageInThread.metaData
            .map((metaData) => {
              if (metaData.type === METADATA_AIP_STATE_MACHINE) {
                return metaData.value as MachineState_0454
              }
            })
            .filter((value) => value !== undefined)

          if (!!stateMetadataString) {
            if (stateMetadataString[0] === MachineState_0454.RequestSent) {
              stateMachineService.start({
                [MachineState_0454.RequestSent]: ChildMachineState_Request.Sent,
              })
            } else {
              stateMachineService.start(stateMetadataString[0])
            }
          }
        }
      } else {
        stateMachineService.start()
      }

      await this.advanceProtocol(message, stateMachineService as any, context)
      stateMachineService.stop()
    } catch (exception: any) {
      console.error('Error while processing an aries 0454 message.', exception)
      console.error(exception.message)
      throw exception
    }

    return message
  }

  private async advanceProtocol(incomingMessage: Message, stateMachine: Interpreter<any, any, any>, context: IContext) {
    let currentState
    const machineSnapshotValue = stateMachine.getSnapshot().value

    // The current State the thread is in
    if (typeof machineSnapshotValue === 'object') {
      currentState = Object.keys(machineSnapshotValue)[0] as MachineState_0454
    } else {
      currentState = machineSnapshotValue as MachineState_0454
    }

    const messageType = incomingMessage.data['@type'] as MESSAGE_TYPES_0454

    // Check if the current state is abandoned or done then we should throw an error or dont react
    if (currentState === MachineState_0454.Abandoned || currentState === MachineState_0454.Done) {
      // or throw an error depending on what we want to do here
      return
    }

    // If we receive a request WE initiated the flow and should therefore be in the current state of InvitationSent
    if (messageType === MESSAGE_TYPES_0454.PROPOSE_PRESENTATION && currentState === MachineState_0454.Start) {
      stateMachine.send({
        type: Transition_0454.ReceiveProposal,
        message: incomingMessage,
        veramoAgent: context.agent,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0454.ProposalReceived))
      return
    }

    if (messageType === MESSAGE_TYPES_0454.REQUEST_PRESENTATION && currentState === MachineState_0454.Start) {
      stateMachine.send({
        type: Transition_0454.ReceiveRequest,
        message: incomingMessage,
        veramoAgent: context.agent,
      })

      await waitFor(stateMachine, (state) => state.matches(MachineState_0454.PresentationSent))
      return
    }

    if (messageType === MESSAGE_TYPES_0454.PRESENTATION && currentState === MachineState_0454.RequestSent) {
      stateMachine.send({
        type: Transition_0454.ReceivePresentation,
        message: incomingMessage,
        veramoAgent: context.agent,
      })

      await waitFor(
        stateMachine,
        (state) => state.matches(MachineState_0454.Done) || state.matches(MachineState_0454.ProblemReportSent)
      )
      return
    }

    if (messageType === MESSAGE_TYPES_0454.PROBLEM_REPORT && currentState === MachineState_0454.PresentationSent) {
      stateMachine.send({
        type: Transition_0454.ReceiveProblemReport,
        message: incomingMessage,
        veramoAgent: context.agent,
        problem: ErrorCodes_0454.ProblemReport,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0454.Abandoned))
      return
    }

    if (messageType === MESSAGE_TYPES_0454.ACK && currentState === MachineState_0454.PresentationSent) {
      stateMachine.send({
        type: Transition_0454.ReceiveAck,
        message: incomingMessage,
        veramoAgent: context.agent,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0454.Done))
      return
    }

    // Nothing could be determined. We send a problem report.
    // TODO Not very spec compliant cause you should not send problem report on start
    return stateMachine.send({ type: Transition_0454.SendProblemReport })
  }

  // Protocol initializer
  private async sendProposal(event: any) {
    const threadId = event.threadId
    const messageId = randomUUID()
    const fromDid = event.fromDid
    const toDid = event.toDid
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesPresentationProposal = {
      '@id': threadId,
      '@type': MESSAGE_TYPES_0454.PROPOSE_PRESENTATION,
      goal_code: '<goal-code>',
      comment: 'no comment',
      credential_preview: {},
      formats: [
        {
          attach_id: '',
          format: '',
        },
      ],
    }

    const didCommMessage: IDIDCommMessage = {
      id: randomUUID(),
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesPresentationProposal,
      type: MESSAGE_TYPES_0454.PROPOSE_PRESENTATION,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'proposal triggered by holder',
      MESSAGE_TYPES_0454.PROPOSE_PRESENTATION,
      MachineState_0454.ProposalSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async sendRequest(event: any) {
    const threadId = event.threadId
    const messageId = randomUUID()
    const fromDid = event.fromDid
    const toDid = event.toDid
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesRequestPresentation = {
      '@id': threadId,
      '@type': MESSAGE_TYPES_0454.REQUEST_PRESENTATION,
      goal_code: '<goal-code>',
      present_multiple: false,
      'request_presentations~attach': [
        {
          '@id': '',
          'mime-type': '',
          data: {
            base64: '<base64 data>',
          },
        },
      ],
      credentialType: event.message.credentialType,
      comment: 'yes please give me the presentation',
    }

    const didCommMessage: IDIDCommMessage = {
      id: randomUUID(),
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesRequestPresentation,
      type: MESSAGE_TYPES_0454.REQUEST_PRESENTATION,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'request sent by verifier',
      MESSAGE_TYPES_0454.REQUEST_PRESENTATION,
      MachineState_0454.RequestSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async sendPresentation(event: any) {
    const messageId = randomUUID()
    const fromDid = event.message.to
    const toDid = event.message.from
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesThreadId = event.message.data['@id']
    // Thread Id for the DIDCOM... the same with the above id(to help readability)
    const didCommThreadId = event.message.threadId

    // check this field in the message sent by the verifier to determine if he will be sending an acknowledgement
    const will_confirm = true

    const expectingAck = will_confirm || true // (second part will be decided if we as prover wants the acknowledgment this will mean adding `~please ack`to this response)
    // if this expecting ack evaluated to false then we save done state in the message sent - this.storeMessage

    // An example of throwing an error to fit event message (to be handled by sendProblemReport)
    // throw {incomingMessage:{ ...event.message}, problem: "We dont accept the type of credential you want to issue", veramoAgent}

    // DO a basic check for the credential data received with rules and stuff and then send credential request

    // const presentation = await this.createPresentation(fromDid, event.message.data.credentialType, veramoAgent)

    const ariesPresentation = {
      '@id': messageId,
      '@type': MESSAGE_TYPES_0454.PRESENTATION,
      '~thread': { thid: ariesThreadId },
      '~please_ack': expectingAck,
      goal_code: '<goal-code>',
      // presentation: presentation,
      comment: 'here is your presentation',
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: didCommThreadId,
      body: ariesPresentation,
      type: MESSAGE_TYPES_0454.PRESENTATION,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      didCommThreadId,
      didCommMessage.body,
      'request sent by holder',
      MESSAGE_TYPES_0454.PRESENTATION,
      MachineState_0454.PresentationSent,
      veramoAgent
    )

    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async receivePresentation(event: any) {
    const message = event.message
    const veramoAgent: VeramoAgent = event.veramoAgent

    try {
      // const verifiedPresentation = await this.verifyPresentation(message.data.presentation, veramoAgent)
      // If need to send Ack write the code for it below here

      // if (verifiedPresentation.verified === true) {
      //   // TODO we have to decide when to send acknowledge
      //   if (message.data['~please_ack']) {
      //     await this.sendAck(event)
      //   }
      //   return
      // }

      // it is not verified therefore we throw an error and send a problem report
      throw {
        incomingMessage: { ...event.message },
        problem: 'We could not verify your presentation... reason?',
        veramoAgent,
      }
    } catch (e: any) {
      throw new Error(e)

      // Send Problem Report
    }
  }

  private async sendAck(event: any) {
    const message = event.message
    const messageId = randomUUID()
    const threadId = message.threadId
    const fromDid = message.to
    const toDid = message.from
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesPresentationAck = {
      '@id': messageId,
      '@type': MESSAGE_TYPES_0454.ACK,
      '~thread': { thid: threadId },
      status: 'OK',
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesPresentationAck,
      type: MESSAGE_TYPES_0454.ACK,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'request sent by holder',
      MESSAGE_TYPES_0454.ACK,
      MachineState_0454.Done,
      veramoAgent
    )

    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async sendProblemReport(event: any) {
    const eventData = event.data || event
    const veramoAgent: VeramoAgent = eventData.veramoAgent
    const incomingMessage = eventData.incomingMessage
    const problem: ErrorCodes_0454 =
      eventData.problem === 'undefined' ? ErrorCodes_0454.ProblemReport : (event.problem as ErrorCodes_0454)

    const toDid = incomingMessage.from
    const fromDid = incomingMessage.to
    const threadId = incomingMessage.threadId

    if (toDid === undefined || fromDid === undefined || threadId === undefined) {
      throw new Error(`Incoming aries 0454 message [${incomingMessage.id}] has missing required fields for evaluation`)
    }

    const messageId = randomUUID()

    const ariesProblemReport = {
      '@type': MESSAGE_TYPES_0454.PROBLEM_REPORT,
      '@id': messageId,
      '~thread': { thid: threadId }, // should be related to the whole thread not the last failing message
      description: { en: 'localized message', code: problem },
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesProblemReport,
      type: MESSAGE_TYPES_0454.PROBLEM_REPORT,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      ariesProblemReport,
      incomingMessage,
      MESSAGE_TYPES_0454.PROBLEM_REPORT,
      MachineState_0454.Abandoned,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async receiveProblemReport(event: any) {
    // React to this problem report

    // Store the received message
    await this.storeReceivedMessages(event, event.message.type, MachineState_0454.Abandoned)
    console.log('stored the message as expected')
  }

  private async receiveAck(event: any) {
    // React to this problem report

    // Store the received message
    await this.storeReceivedMessages(event, event.message.type, MachineState_0454.Done)
    console.log('stored the ack message as expected')
  }

  private async storeReceivedMessages(
    event: any,
    messageType: MESSAGE_TYPES_0454,
    machineStateToStore: MachineState_0454
  ) {
    const message = event.message
    const threadId = message.threadId
    const messageId = message.data['@id']
    const fromDid = message.from
    const toDid = message.to
    const veramoAgent: VeramoAgent = event.veramoAgent

    await this.storeMessage(
      randomUUID(), //TODO remove this should not be important but since its the same DB the last message is overwritten should use messageID instead
      fromDid,
      toDid,
      threadId,
      message.data,
      `receive message of type ${event.message.type}`,
      messageType,
      machineStateToStore,
      veramoAgent,
      true
    )
  }

  private async packAndSendMessage(message: IDIDCommMessage, recipientDid: string, veramoAgent: VeramoAgent) {
    try {
      const packedMessage = await veramoAgent.packDIDCommMessage(
        {
          packing: DIDCommMessagePacking.AUTHCRYPT,
          message: message,
        },
        {} as any
      )
      await veramoAgent
        .sendDIDCommMessage(
          {
            messageId: message.id,
            packedMessage,
            recipientDidUrl: recipientDid,
          },
          {} as any
        )
        .then(() => {
          console.debug(`[Aries 0454 Sent didcomm message of type [${message.type}] to did [${recipientDid}]`)
        })
        .catch((err) => {
          console.error({ err }, `Unable to send didcomm message for aries 0454 flow with threadId [${message.thid}]`)
          throw err
        })
    } catch (err) {
      console.error(
        { err },
        `Unable to pack and send didcomm message for aries 0454 flow with threadId [${message.thid}]`
      )
      throw err
    }
  }

  private async storeMessage(
    messageId: string,
    fromDid: string,
    toDid: string,
    threadId: any,
    ariesData: object,
    inResponseTo: any,
    messageType: MESSAGE_TYPES_0454,
    machineState: MachineState_0454,
    veramoAgent: VeramoAgent,
    receivedMessage: boolean = false
  ) {
    try {
      const storedMessage = {
        id: messageId,
        createdAt: new Date().toISOString(),
        type: messageType,
        from: fromDid,
        to: toDid,
        threadId: threadId,
        data: ariesData,
        metaData: [
          {
            type: METADATA_AIP_TYPE,
            value: messageType,
          },
          {
            type: METADATA_AIP_STATE_MACHINE,
            value: machineState,
          },
          {
            type: METADATA_AIP_IN_RESPONSE_TO,
            value: JSON.stringify(inResponseTo),
          },
          {
            type: METADATA_AIP_RECEIVED_MESSAGE,
            value: receivedMessage.toString(),
          },
        ],
      }

      await veramoAgent.dataStoreSaveMessage({
        message: storedMessage,
      })
    } catch (exception) {
      console.error(`Unable to save message for aries 0454 flow with threadId [${threadId}]`, exception)
      throw exception
    }
  }

  // private async createPresentation(holderDid: string, credentialType: CredentialType, veramoAgent: VeramoAgent) {
  //   const holderIdentifier = await this.prisma?.identifier.findFirst({
  //     where: { did: holderDid },
  //     orderBy: { createdAt: 'desc' },
  //   })

  //   if (!holderIdentifier) {
  //     throw new NotFoundException(`Identifier<${holderDid}> was not found`)
  //   }

  //   if (!holderIdentifier.tenantId) {
  //     throw new BadRequestException(`Identifier<${holderDid}> is not part of a tenant`)
  //   }

  //   const credentials = await this.prisma?.credential.findMany({
  //     where: {
  //       tenantId: holderIdentifier.tenantId,
  //       type: credentialType,
  //       data: {
  //         path: ['credentialSubject', 'id'],
  //         equals: holderDid,
  //       },
  //     },
  //     orderBy: { createdAt: 'desc' },
  //   })

  //   if (credentials?.length == 0) {
  //     throw new NotFoundException(`Identifier<${holderDid}> has no credential of CredentialType<${credentialType}>`)
  //   }

  //   const currentIdentityCredential = credentials?.find(async (credential) => {
  //     const status = await veramoAgent.checkCredentialStatus(
  //       { credential: credential.data as CredentialJwtOrJSON },
  //       {} as any
  //     )
  //     // TODO: Expiration check
  //     if (!status.revoked) return credential
  //   })

  //   if (!currentIdentityCredential) {
  //     throw new NotFoundException(
  //       `Identifier<${holderDid}> has no valid credential of CredentialType<${credentialType}>`
  //     )
  //   }

  //   const issuanceDate = new Date()
  //   const presentation = await veramoAgent.createVerifiablePresentation(
  //     {
  //       presentation: {
  //         verifiableCredential: [currentIdentityCredential.data as W3CVerifiableCredential],
  //         holder: holderDid,
  //         issuanceDate: issuanceDate.toISOString(),
  //       },
  //       proofFormat: 'jwt',
  //     },
  //     {} as any
  //   )
  //   return presentation.proof.jwt
  // }

  // private async verifyPresentation(verifiablePresentation: any, veramoAgent: VeramoAgent) {
  //   const verificationResponse = await veramoAgent.verifyPresentation(
  //     {
  //       presentation: verifiablePresentation,
  //       // We only want to check the signature and its general validity
  //       // The rest we handle manually to throw the correct OCI error codes
  //       policies: {
  //         issuanceDate: false,
  //         expirationDate: false,
  //         aud: false,
  //       },
  //     },
  //     {} as any
  //   )

  //   return verificationResponse
  // }
}
