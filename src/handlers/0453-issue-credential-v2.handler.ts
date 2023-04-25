import { AbstractMessageHandler, Message } from '@veramo/message-handler'
import { IAgentContext, IDataStore, IDIDManager, IKeyManager } from '@veramo/core'
import { IDIDComm } from '@veramo/did-comm/src/types/IDIDComm'
import { IDataStoreORM } from '@veramo/data-store'
import { createMachine, interpret, Interpreter, StateMachine } from 'xstate'
import { randomUUID } from 'crypto'
import { waitFor } from 'xstate/lib/waitFor'
import { IDIDCommMessage } from '@veramo/did-comm/src/types/message-types'
import { VeramoAgent, IContext } from '../types/VeramoAgent'

export enum MESSAGE_TYPES_0453 {
  PROPOSE_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/propose-credential',
  OFFER_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/offer-credential',
  REQUEST_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/request-credential',
  ISSUE_CREDENTIAL = 'https://didcomm.org/issue-credential/2.1/issue-credential',
  PROBLEM_REPORT = 'https://didcomm.org/issue-credential/2.1/problem_report',
  COMPLETE = 'https://didcomm.org/issue-credential/2.1/complete',
}

/*
 * All possible states of the protocol for both sides
 * Some states are 'actionable' meaning that a machine should never stop in them (marked with //actionable)
 * Actionable states will have modeled invocations which either advance, or abandon the thread
 * */
export enum MachineState_0453 {
  Start = 'start',
  ProposalSent = 'proposal-sent',
  ProposalReceived = 'proposal-received',
  OfferSent = 'offer-sent',
  OfferReceived = 'offer-received',
  RequestSent = 'request-sent',
  RequestReceived = 'request-received', // [2]Actionable because we received a request after an invitation and now need to answer
  CredentialIssued = 'credential-issued',
  CredentialReceived = 'credential-received',
  Abandoned = 'abandoned',
  AckSent = 'ack-sent',
  AckReceived = 'ack-received',
  ProblemReportSent = 'send-problem-report',
  ProblemReportReceived = 'receive-problem-report',
  Complete = 'complete',
  ContinueOrSendProblemReport = 'continue-or-send-report',
}

export enum ChildMachineState_Offer {
  Pending = 'offerPending',
  Sent = 'offerSent',
}

export enum ChildMachineState_Proposal {
  Pending = 'proposalPending',
  Sent = 'proposalSent',
}

export enum ChildMachineState_Request {
  Pending = 'requestPending',
  Sent = 'requestSent',
}

export enum Transition_0453 {
  SendProposal = 'Send Proposal',
  SendOffer = 'Send Offer',
  SendRequest = 'Send Request',
  IssueCredential = 'Issue Credential',
  ReceiveProposal = 'Receive Proposal',
  ReceiveOffer = 'Receive Offer',
  ReceiveRequest = 'Receive Request',
  ReceiveCredential = 'Receive Credential',
  SendAck = 'Send Ack',
  ReceiveAck = 'Receive Ack',
  SendProblemReport = 'Send Problem Report',
  ReceiveProblemReport = 'Receive Problem Report',
}

export enum ErrorCodes_0453 {
  IssuanceAbandoned = 'issuance-abandoned',
  //ProblemReport = 'problem-report',
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
export class IssueCredential0453MessageHandler extends AbstractMessageHandler {
  private issueCredentialFunction: Function
  private receiveCredentialFunction: Function
  constructor(issueCredentialCallback: Function, receiveCredentialCallback: Function) {
    super()
    this.issueCredentialFunction = issueCredentialCallback
    this.receiveCredentialFunction = receiveCredentialCallback
  }

  get stateMachineConfiguration(): StateMachine<any, any, any> {
    return this._stateMachineConfiguration
  }
  // Machine for RFC 0453 - Issue Credential V2

  private readonly _stateMachineConfiguration = createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QCUBiBhADAFgKwGYA6WAFwEMAnEgYgGUwA7CAAgHkAzdsCgbUwF1EoAA4B7WAEsSE0QyEgAHogCM+TIQBsuDQCZsATmwaNyzMp0AaEAE9EADkzq9+-doDsex3eUBfH1bQsPCJSShp6JmYABQpRMVgyABs+QSQQeKkZOTSlBGVsdS1dAyMTM0sbRHwHQmxlY2VXbGx8fFx6vwCMHAJicio6RhZkMABHAFc4EhT5DOlZeVzVQu1nUtNzK1sEb1qXfbbDerd8TpBAnpD+mhGAYzAJADcwaNj4pJm0uazFlQLNVYlBrlLaILRuPYuE7afKYbRnC7BPphah3B7PNicbifETiTILHJ-FbFQzAzaVPL4ZSEfb6fD6HR2HQmOl2BHdJGiLEUAC0sEYNzA9yeLxGEymOPSePm2VAS3p6mCOkwVNamDc+mUoIQGv0tXqula+kwGjc2DZ-nOHN6XK4vP5DEFwoxMVEACNEmAALbMEZiKiS74EuUqBW1AjK1VqDVailuTB2Gn7Yy4Rw6Uz6dlBG3cvkCwi27hRIYSBhQagQWRgQilx6iADW1dCVAA+g6IBw7YHpT9CQgXBpCOm7BqTmoXLhcNq3HY9XZWjoTsozbh9HYLV1s0RhG9xEk847UUL0S9O9iBLMe8HFIh9BpsIQZ5r6W4zfgWlOKTpcDpHwY73UmDMmmWaXIQO5xHuiQHk6J6vO6no+n6ogBheXxXrKN79vej6zqo+ivi0H7aqm1IGveLT3lSq5uKBSIQe80EOiQ4G7gkiTFkwpblpWDDVrWDZNtcbZDK6jHdpIMq-Ag7S4IQOAaHYLTvjO3j4NqBTUsYxgqsoDiOG4+R0b0FBjJMpAwUezovOgpkQAKEgfGhuKSb2Ib9hU2zKMuc6tGo9R2KuGinJaiImWZUwwYQpniqQnEQNxFZVjWDB1o2yKtjF5kkBE0zOVKrnXksbiKXs37fgUd7Lp5KiGPJjgGau-4mBoxnbmx+6mdZEBJXxKVpdWDFQWiIoQCJTBnrw+VBphuSyUORT4FogWYK4sbbKaRDOGuDipu+BFtaxkHsTyXUnj13CxBQ4GJGQJDsChXpHYxI3PGN7aTRJ+KzYg83MtoS24Cta0ke0mgpkpjJuO0SmHYWvJnaNvX8algkFtyr2QONJBitlX1SX25jGkOBE4HCeBaJ+2zKnJmqmjo+AeN5OAhZuYHw6dx5I5dKE3XdD0UE98OY+9Aq4xK00YdJRNOKTBS4BTk7at+RB1MYM46C4djaYdtyyNIDCTDyKEHhAnP+jQvEowNhB646paTC2KHjRAroet6yGoakLnfdJAG4c+BFvsRFLVNSdPq+qBjvhuVpbrb+sO2Axv2kM5soTQPPXcIt33Y9Cf24bYBOxQLtu4hnt5d7BW+32TLauYaiEH5bSqN+DLYLRoXWkQWWRYjb3I-1aN96QIsthIsCwJMtmQA5TnVzN0k-g3GhwkOqbKo43kmNgh2jyQnPddQACSU+TMws-2fbC+XoVP0ILoDeTg+0NAXCDOOPgOi63Z8-QZPaekArJwQAIK3HrPjNyWEFaJnqC0UwehZxLTsM-O8hBUxmAcK+FwBQ97d3jrcP+N9oID2AVbYe6UiFzxIePds6BRBehzmAEgYAoFFV+trWow4iZjkBg3PS1IW4GHTEURch0yAQKPudIeAl0qSPrOPPWTDPSsPYQ-bWRAXB6H-J3IwaDEwNR0IyKk5MJFSOYrI1G8iIG5RbMo5hajJb32luqIgKpjT3m0HeVoAjdjCIZPUVYXc2ZInbDyCC7svTpwGBQuRg1YhRMrrldRy81wYJnKYNxJjsA1UpOaR8m98iGQVpqQ64TImIRieEIY8Eom+jABbVJfZVyJlwJkgy395y5IbprRM34zBaHVJOTW+DQnhWshExJVTTIWysTbSpHtGkZxFs09yHgG6dwhAMyMBg4Srh-mcBgoh7LwDSGFfAd9a7uR5BobUPJaa0iefsYx5TrhXIJu5HpocagRyMARNoSDcBw1zMxD50DcgzgfMoAGHjmgmG-NqU0EJ5xdIIGaTuS0QV2iivDeK3FwUcJ2N-QgMLgpwqMOYKmiASpyT8syE4ZhGbQ2xdwXF3JcqEofuYIC9UZwzmMGoTWbhpwjgwfORcZpwRrlagQsCQ0TpgvQi4vsmsnC5OXJ3BMrQjDqS-LOcGDR0U7UaKzOO8qOpMXzAqpI+Kyxcukq0fpGqzTxlRbq7UzLSUpgBSaGcQMzUXOelBKKNrEicuVdcrCZpfx3lWqaPA7STR5PpHqNWa9XU8o0HSfeEULJKp9p8rCMKwY4EMtqkca9UEUiZPVRw7TjFuMIrm2Kh9mLRTzSQO1UAHWE1XHqMtph5yVoTKvPUmC4TLTMArMZ5qkQHyigfCNhaIW1XXM3Y0d4VblECg3TUhTHDq2aO0ycwK5X0UtdI0avb3JdI3jOFUbjKotCRe+SEa5Xyziaoc8ZRAOZkIgDe4t5hBwMzwJ3GFDINlfnyIa00Dh6TeVMGe39BcDZGxNuE2ZGcgNLHcI+JDBFzDa1ySmuo77Fxf0PbOoNC6AO4ZUO0h8-1FJKQoiqacJV9SCpKnpTRNGe622IdIfcgDJiAcjUW3IS1BwEAZG0UcJw2NoIhEYhMypny-xoSJ0hXM3oMYQNUPUBEtCLkCqoe8+gBHaEIKixkSklJbvMfWK9+nJOrsfi4GkmtXBFFMK+PJMKTgYO3qadpyCGTOZggZ40iYTPtO8hK0i1nBx2fXOaAwuhylp0WdE7DVADNGZpLSsz7QloGAbqYut6Zj2YoVrmyZuXqkGfqIuZusk6SvhKoZEVFJTTqAjvAwFGoJFujIEwKsEmV1EuHUODMjMRzpkMtWryuqQtMtnK4VamZz29AcaosALXNZyVTAF+8eEUHP3Xdq0iMZlzvj8H4IAA */
    id: 'RFC0453',
    initial: MachineState_0453.Start,
    context: {
      problemcode: undefined,
    },
    states: {
      // Starting States for the Machine,
      // 1. The Issuer can start by sending the Offer
      // 2. The holder can start by sending a Proposal
      // 3. The holder can start by sending a Request
      [MachineState_0453.Start]: {
        on: {
          [Transition_0453.SendOffer]: {
            target: MachineState_0453.OfferSent,
          },
          [Transition_0453.SendProposal]: {
            target: MachineState_0453.ProposalSent,
          },
          [Transition_0453.SendRequest]: {
            target: MachineState_0453.RequestSent,
          },
          [Transition_0453.ReceiveProposal]: {
            target: MachineState_0453.ProposalReceived,
          },
          [Transition_0453.ReceiveOffer]: {
            target: MachineState_0453.OfferReceived,
          },
          [Transition_0453.SendProblemReport]: {
            target: MachineState_0453.ProblemReportSent,
          },
        },
      },

      // Offer Sent State is an Issuer State
      // This has children states, because from Start to Offer Sent, you can have an intermediate state of Pending.
      [MachineState_0453.OfferSent]: {
        initial: ChildMachineState_Offer.Pending,
        states: {
          // Sending the offer if the children state is Pending
          [ChildMachineState_Offer.Pending]: {
            invoke: {
              id: 'start_sendOffer',
              src: async (_, event) => await this.sendOffer(event),
              onDone: {
                target: ChildMachineState_Offer.Sent,
              },
            },
          },
          // If the offer is sent, then the children state is Sent and Final.
          [ChildMachineState_Offer.Sent]: {
            type: 'final',
          },
        },
        // This state can go down 3 routes.
        on: {
          // 1. If issuer receives a Proposal on his Offer (Receive Proposal -> Proposal Received)
          // [Transition_0453.ReceiveProposal]: {
          //   target: MachineState_0453.ProposalReceived,
          // },

          // 2. If issuer receives a Request on his Offer (Receive Ruquest -> Request Received)
          [Transition_0453.ReceiveRequest]: {
            target: MachineState_0453.RequestReceived,
          },
          // 3. If issuer receives a problem report on his Offer (Receive Problem Report -> Abandoned)
          [Transition_0453.ReceiveProblemReport]: {
            target: MachineState_0453.ProblemReportReceived,
          },
        },
      },

      // Proposal Sent State is a holder State
      // This has children states, because from Start to Proposal Sent, you can have an intermediate state of Pending.
      [MachineState_0453.ProposalSent]: {
        initial: ChildMachineState_Proposal.Pending,
        states: {
          // Sending the proposal if the children state is Pending
          [ChildMachineState_Proposal.Pending]: {
            invoke: {
              id: 'start_sendProposal',
              src: async (_, event) => await this.sendProposal(event),
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
          [Transition_0453.ReceiveOffer]: {
            target: MachineState_0453.OfferReceived,
          },

          // 2. If holder receives a Problem Report on his Offer (Receive Problem Report -> Abandoned)
          [Transition_0453.ReceiveProblemReport]: {
            target: MachineState_0453.ProblemReportReceived,
          },
        },
      },

      // Request Sent is a holder state
      // This has children states, because from Start to Request Sent, you can have an intermediate state of Pending.
      [MachineState_0453.RequestSent]: {
        initial: ChildMachineState_Request.Pending,
        states: {
          // Sending the Request if the children state is Pending
          [ChildMachineState_Request.Pending]: {
            invoke: {
              id: 'start_requestSent',
              src: async (_) => console.log('sent request 0453'),
              onDone: {
                target: ChildMachineState_Request.Sent,
              },
            },
          },

          // If the Request is sent, then the children state is Sent and Final.
          [ChildMachineState_Request.Sent]: {
            type: 'final',
          },
        },

        // This state can go down 1 route.
        on: {
          // 1. The holder gets a credential issued to his Request.
          [Transition_0453.ReceiveCredential]: {
            target: MachineState_0453.CredentialReceived,
          },
        },
      },

      // Proposal Received is an Issuer State
      [MachineState_0453.ProposalReceived]: {
        invoke: {
          id: 'proposalReceived_sendOffer',
          src: async (_, event) => await this.sendOffer(event),
          onDone: {
            target: MachineState_0453.OfferSent,
          },
          onError: {
            target: MachineState_0453.ProblemReportSent,
          },
        },
      },

      // TODO: This doesn't respect the retry flow for the Offer Received, which would make it go back to propose credential
      [MachineState_0453.OfferReceived]: {
        invoke: {
          id: 'offerReceived_sentRequest',
          src: async (_, event) => await this.sendRequest(event),
          onDone: {
            target: MachineState_0453.RequestSent,
          },
          onError: {
            target: MachineState_0453.ProblemReportSent,
          },
        },
      },

      [MachineState_0453.ContinueOrSendProblemReport]: {
        invoke: {
          id: 'continue_or_sendProblemReport',
          src: async (_, _event) =>
            await console.log('decide to whether want credential or propose something new or send problem'),
          onDone: {
            target: MachineState_0453.ProposalSent,
          },
          onError: {
            target: MachineState_0453.ProblemReportSent,
          },
        },
      },

      [MachineState_0453.RequestReceived]: {
        invoke: {
          id: 'requestReceived_issueCredential',
          src: async (_, event) => await this.issueCredential(event),
          onDone: {
            target: MachineState_0453.CredentialIssued,
          },
        },
        on: {
          [Transition_0453.IssueCredential]: {
            target: MachineState_0453.CredentialIssued,
          },
        },
      },

      [MachineState_0453.CredentialIssued]: {
        on: {
          [Transition_0453.ReceiveAck]: {
            target: MachineState_0453.AckReceived,
          },
        },
      },

      [MachineState_0453.CredentialReceived]: {
        invoke: {
          id: 'credentialReceived_sendComplete',
          src: async (_, event) => await this.receiveCredentialAndSendAck(event),
          onDone: {
            target: MachineState_0453.AckSent,
          },
        },
      },
      [MachineState_0453.AckReceived]: {
        invoke: {
          id: 'ackReceived_complete',
          src: async (_, _event) => console.log('the ack is received, done'),
          onDone: {
            target: MachineState_0453.Complete,
          },
        },
      },
      [MachineState_0453.AckSent]: {
        invoke: {
          id: 'ackSent_complete',
          src: async (_, _event) => console.log('the ack is sent, done'),
          onDone: {
            target: MachineState_0453.Complete,
          },
        },
      },
      [MachineState_0453.ProblemReportSent]: {
        invoke: {
          id: 'problemReportSent',
          src: async (_, event) => await this.sendProblemReport(event),
          onDone: {
            target: MachineState_0453.Abandoned,
          },
        },
      },
      [MachineState_0453.ProblemReportReceived]: {
        invoke: {
          id: 'problemReportReceived',
          src: async (_, event) =>
            await this.storeReceivedMessages(event, MESSAGE_TYPES_0453.PROBLEM_REPORT, MachineState_0453.Abandoned),
          onDone: {
            target: MachineState_0453.Abandoned,
          },
        },
      },
      [MachineState_0453.Abandoned]: {
        type: 'final',
      },
      [MachineState_0453.Complete]: {
        type: 'final',
      },
    },
    schema: {
      events: {} as
        | { type: Transition_0453.SendOffer }
        | { type: Transition_0453.ReceiveOffer }
        | { type: Transition_0453.SendProposal }
        | { type: Transition_0453.ReceiveProposal }
        | { type: Transition_0453.SendRequest }
        | { type: Transition_0453.ReceiveRequest }
        | { type: Transition_0453.IssueCredential }
        | { type: Transition_0453.ReceiveCredential }
        | { type: Transition_0453.SendProblemReport }
        | { type: Transition_0453.ReceiveProblemReport }
        | { type: Transition_0453.SendAck }
        | { type: Transition_0453.ReceiveAck },
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
    if (!Object.values(MESSAGE_TYPES_0453).includes(message.data['@type'])) {
      console.log(
        `Received didcomm message of type: [${message.data['@type']}] which is not handled by DidExchange0453MessageHandler. Passing to next handler.`
      )
      return super.handle(message, context)
    }

    try {
      if (!message.threadId || !message.to || !message.from || !message.id || !message.data) {
        throw new Error(`Incoming aries 0453 message has missing required fields for evaluation [${message}]`)
      }

      console.log(
        `Received didcomm message of type: [${message.data['@type']}] from did [${message.from}] for thread [${message.threadId}]`
      )

      const stateMachineService = interpret(this._stateMachineConfiguration)

      // check if we have stored an abandoned on this thread (recived a problem report)
      const recievedSavedMessages = await context.agent.dataStoreORMGetMessages({
        where: [
          { column: 'threadId', value: [message.threadId] },
          { column: 'from', value: [message.from] },
        ],
        order: [{ column: 'createdAt', direction: 'DESC' }],
      })
      if (recievedSavedMessages && recievedSavedMessages.length !== 0) {
        const lastReceivedMessageInThread = recievedSavedMessages[0] as Message
        if (lastReceivedMessageInThread.metaData) {
          const stateMetadataObj = lastReceivedMessageInThread.metaData.reduce(
            (obj, metaData) => {
              if (metaData.type === METADATA_AIP_RECEIVED_MESSAGE && metaData.value === true.toString()) {
                return { ...obj, received: true }
              }
              if (metaData.type === METADATA_AIP_STATE_MACHINE) {
                return { ...obj, state: metaData.value as MachineState_0453 }
              }
              return obj
            },
            { received: false, state: MachineState_0453.Start } as { received: boolean; state: MachineState_0453 }
          )

          if (
            !!stateMetadataObj &&
            stateMetadataObj['received'] === true &&
            stateMetadataObj['state'] === MachineState_0453.Abandoned
          ) {
            throw new Error(`Communication with the thread [${message.threadId}] is already abandoned start a new flow`)
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
                return metaData.value as MachineState_0453
              }
            })
            .filter((value) => value !== undefined)

          if (!!stateMetadataString) {
            if (stateMetadataString[0] === MachineState_0453.RequestSent) {
              stateMachineService.start({
                [MachineState_0453.RequestSent]: 'requestSent',
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
      console.error('Error while processing an aries 0453 message.', exception)
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
      currentState = Object.keys(machineSnapshotValue)[0] as MachineState_0453
    } else {
      currentState = machineSnapshotValue as MachineState_0453
    }

    const messageType = incomingMessage.data['@type'] as MESSAGE_TYPES_0453

    // Check if the current state is abandoned then we should throw an error or dont react
    if (currentState === MachineState_0453.Abandoned) {
      // or throw an error depending on what we want to do here
      return
    }

    // If we receive a PROPOSAL initiated the flow and should therefore be in the current state of ReceiveProposal
    if (messageType === MESSAGE_TYPES_0453.PROPOSE_CREDENTIAL && currentState === MachineState_0453.Start) {
      stateMachine.send({
        type: Transition_0453.ReceiveProposal,
        message: incomingMessage,
        veramoAgent: context.agent,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0453.ProposalReceived))
      return
    }

    if (messageType === MESSAGE_TYPES_0453.OFFER_CREDENTIAL && currentState === MachineState_0453.Start) {
      stateMachine.send({
        type: Transition_0453.ReceiveOffer,
        message: incomingMessage,
        veramoAgent: context.agent,
      })

      await waitFor(
        stateMachine,
        (state) => state.matches(MachineState_0453.RequestSent) || state.matches(MachineState_0453.Abandoned)
      )
      return
    }

    if (messageType === MESSAGE_TYPES_0453.REQUEST_CREDENTIAL && currentState === MachineState_0453.OfferSent) {
      stateMachine.send({
        type: Transition_0453.ReceiveRequest,
        message: incomingMessage,
        veramoAgent: context.agent,
      })

      await waitFor(stateMachine, (state) => state.matches(MachineState_0453.CredentialIssued))
      return
    }

    if (messageType === MESSAGE_TYPES_0453.ISSUE_CREDENTIAL && currentState === MachineState_0453.RequestSent) {
      stateMachine.send({
        type: Transition_0453.ReceiveCredential,
        message: incomingMessage,
        veramoAgent: context.agent,
      })

      // should wait for acksent here but not currently sending an acknowledgement
      await waitFor(stateMachine, (state) => state.matches(MachineState_0453.CredentialReceived))
      return
    }

    // TODO we need to discuss how to handle better  cause not all states have a problem report route.

    if (messageType === MESSAGE_TYPES_0453.PROBLEM_REPORT) {
      stateMachine.send({
        type: Transition_0453.ReceiveProblemReport,
        message: incomingMessage,
        veramoAgent: context.agent,
        problem: ErrorCodes_0453.IssuanceAbandoned,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0453.Abandoned))
      return
    }

    // Nothing could be determined. We send a problem report.
    // TODO Not very spec compliant cause you should not send problem report on start
    return stateMachine.send({ type: Transition_0453.SendProblemReport })
  }

  // Protocol initializer
  private async sendProposal(event: any) {
    const threadId = event.threadId
    const messageId = randomUUID()
    const fromDid = event.fromDid
    const toDid = event.toDid
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesIssueCredentialProposal = {
      '@id': threadId,
      '@type': MESSAGE_TYPES_0453.PROPOSE_CREDENTIAL,
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
      body: ariesIssueCredentialProposal,
      type: MESSAGE_TYPES_0453.PROPOSE_CREDENTIAL,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'proposal triggered by holder',
      MESSAGE_TYPES_0453.PROPOSE_CREDENTIAL,
      MachineState_0453.ProposalSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async sendOffer(event: any) {
    const threadId = event.threadId
    const messageId = randomUUID()
    const fromDid = event.fromDid
    const toDid = event.toDid
    const veramoAgent: VeramoAgent = event.veramoAgent
    const credentialMessage = event.message.credentialBody

    const ariesIssueCredentialOffer = {
      '@id': threadId,
      '@type': MESSAGE_TYPES_0453.OFFER_CREDENTIAL,
      goal_code: '<goal-code>',
      comment: "We'd issue you a credential just like this one",
      credential_preview: {
        data: credentialMessage.data,
        credentialId: credentialMessage.credentialId,
        issuanceDate: credentialMessage.issuanceDate || undefined,
        expirationDate: credentialMessage.expirationDate || undefined,
        credentialType: credentialMessage.credentialType,
        credentialStatusId: credentialMessage.credentialStatusId || undefined,
        onboardingId: credentialMessage.onboardingId || undefined,
      },
    }

    const didCommMessage: IDIDCommMessage = {
      id: randomUUID(),
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesIssueCredentialOffer,
      type: MESSAGE_TYPES_0453.OFFER_CREDENTIAL,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'offer sent by issuer',
      MESSAGE_TYPES_0453.OFFER_CREDENTIAL,
      MachineState_0453.OfferSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async sendRequest(event: any) {
    const messageId = randomUUID()
    const fromDid = event.message.to
    const toDid = event.message.from
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesThreadId = event.message.data['@id']
    // Thread Id for the DIDCOM... the same with the above id(to help readability)
    const didCommThreadId = event.message.threadId
    // An example of throwing an error to fit event message (to be handled by sendProblemReport)
    // throw {incomingMessage:{ ...event.message}, problem: "We dont accept the type of credential you want to issue", veramoAgent}

    // DO a basic check for the credential data received with rules and stuff and then send credential request

    const ariesIssueCredentialRequest = {
      '@id': messageId,
      '@type': MESSAGE_TYPES_0453.REQUEST_CREDENTIAL,
      '~thread': { thid: ariesThreadId },
      goal_code: '<goal-code>',
      comment: 'yes please give me the credential',
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: didCommThreadId,
      body: ariesIssueCredentialRequest,
      type: MESSAGE_TYPES_0453.REQUEST_CREDENTIAL,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      didCommThreadId,
      didCommMessage.body,
      'request sent by holder',
      MESSAGE_TYPES_0453.REQUEST_CREDENTIAL,
      MachineState_0453.RequestSent,
      veramoAgent
    )

    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async issueCredential(event: any) {
    const threadId = event.message.threadId
    const messageId = randomUUID()
    const fromDid = event.message.to
    const toDid = event.message.from
    const veramoAgent: VeramoAgent = event.veramoAgent
    const ariesThreadId = event.message.data['~thread'].thid
    const messages = (await veramoAgent.dataStoreORMGetMessages(
      {
        // We only want to retrieve messages that are not from ourselves (as in sent by us)
        where: [
          { column: 'threadId', value: [threadId] },
          { column: 'from', value: [fromDid] },
        ],
        order: [{ column: 'createdAt', direction: 'DESC' }],
      },
      {} as any
    )) as any

    const credential_preview = messages[0].data.credential_preview

    let createdCredential

    try {
      createdCredential = await this.issueCredentialFunction(credential_preview, fromDid, toDid, veramoAgent)
    } catch (e: any) {
      throw Error(e)
    }

    const ariesIssueCredential = {
      '@id': messageId,
      '@type': MESSAGE_TYPES_0453.ISSUE_CREDENTIAL,
      '~thread': {
        thid: ariesThreadId,
      },
      goal_code: '<goal-code>',
      comment: 'here is your credential',
      credentials: [createdCredential],
      onboardingId: credential_preview.onboardingId || undefined,
      formats: [
        {
          attach_id: '',
          format: '',
        },
      ],
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesIssueCredential,
      type: MESSAGE_TYPES_0453.ISSUE_CREDENTIAL,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'credential issued by issuer',
      MESSAGE_TYPES_0453.ISSUE_CREDENTIAL,
      MachineState_0453.CredentialIssued,
      veramoAgent
    )

    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async receiveCredentialAndSendAck(event: any) {
    const message = event.message
    const threadId = message.threadId
    const messageId = randomUUID()
    const fromDid = message.to
    const toDid = message.from
    const veramoAgent: VeramoAgent = event.veramoAgent

    const credential = message.data.credentials[0]

    try {
      await this.receiveCredentialFunction(fromDid, credential, message)

      // If need to send Ack please create a merge request for it.
    } catch (e: any) {
      throw Error(e)
    }
  }

  private async sendProblemReport(event: any) {
    const eventData = event.data || event
    const veramoAgent: VeramoAgent = eventData.veramoAgent
    const incomingMessage = eventData.incomingMessage
    const problem: ErrorCodes_0453 =
      eventData.problem === 'undefined' ? ErrorCodes_0453.IssuanceAbandoned : (event.problem as ErrorCodes_0453)

    const toDid = incomingMessage.from
    const fromDid = incomingMessage.to
    const threadId = incomingMessage.threadId

    if (toDid === undefined || fromDid === undefined || threadId === undefined) {
      throw new Error(`Incoming aries 0453 message [${incomingMessage.id}] has missing required fields for evaluation`)
    }

    const messageId = randomUUID()

    const ariesProblemReport = {
      '@type': MESSAGE_TYPES_0453.PROBLEM_REPORT,
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
      type: MESSAGE_TYPES_0453.PROBLEM_REPORT,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      ariesProblemReport,
      incomingMessage,
      MESSAGE_TYPES_0453.PROBLEM_REPORT,
      MachineState_0453.Abandoned,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  private async storeReceivedMessages(
    event: any,
    messageType: MESSAGE_TYPES_0453,
    machineStateToStore: MachineState_0453
  ) {
    const message = event.message
    const threadId = message.threadId
    const messageId = message.data['@id']
    const fromDid = message.from
    const toDid = message.to
    const veramoAgent: VeramoAgent = event.veramoAgent

    await this.storeMessage(
      randomUUID(), //TODO remove this should not be important but since its the same DB the last message is overwritten
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
          packing: "authcrypt",
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
          console.debug(`[Aries 0453 Sent didcomm message of type [${message.type}] to did [${recipientDid}]`)
        })
        .catch((err: any) => {
          console.error({ err }, `Unable to send didcomm message for aries 0453 flow with threadId [${message.thid}]`)
          throw err
        })
    } catch (err) {
      console.error(
        { err },
        `Unable to pack and send didcomm message for aries 0453 flow with threadId [${message.thid}]`
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
    messageType: MESSAGE_TYPES_0453,
    machineState: MachineState_0453,
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
      console.error(`Unable to save message for aries 0453 flow with threadId [${threadId}]`, exception)
      throw exception
    }
  }

  public static getMachineConfig() {
    return new this(
      () => {},
      () => {}
    ).stateMachineConfiguration
  }
}
