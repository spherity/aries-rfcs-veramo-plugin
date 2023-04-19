import { AbstractMessageHandler, Message } from '@veramo/message-handler'
import { IAgentContext, IDataStore, IDIDManager, IKeyManager } from '@veramo/core'
import { IDIDComm } from '@veramo/did-comm/src/types/IDIDComm'
import { IDataStoreORM } from '@veramo/data-store'
import { createMachine, interpret, Interpreter, StateMachine } from 'xstate'
import { randomUUID } from 'crypto'
import { waitFor } from 'xstate/lib/waitFor'
import { IDIDCommMessage } from '@veramo/did-comm/src/types/message-types'
import { VeramoAgent } from '../types/VeramoAgent'
import { DIDCommMessagePacking } from '../types/IAriesRFCsPlugin'

type IContext = IAgentContext<IDIDManager & IKeyManager & IDIDComm & IDataStore & IDataStoreORM>

enum MESSAGE_TYPE {
  INVITATION = 'https://didcomm.org/out-of-band/1.1/invitation',
  REQUEST = 'https://didcomm.org/didexchange/1.0/request',
  RESPONSE = 'https://didcomm.org/didexchange/1.0/response',
  PROBLEM_REPORT = 'https://didcomm.org/didexchange/1.0/problem_report',
  COMPLETE = 'https://didcomm.org/didexchange/1.0/complete',
}

/*
 * All possible states of the protocol for both sides
 * Some states are 'actionable' meaning that a machine should never stop in them (marked with //actionable)
 * Actionable states will have modeled invocations which either advance, or abandon the thread
 * */
export enum MachineState_0023 {
  Start = 'start',
  InvitationSent = 'invitation-sent',
  InvitationReceived = 'invitation-received', // [1]Actionable because we received an invitation and now need to answer
  RequestSent = 'request-sent',
  RequestReceived = 'request-received', // [2]Actionable because we received a request after an invitation and now need to answer
  ResponseSent = 'response-sent',
  ResponseReceived = 'response-received', // [3]Actionable because we received a response to a request after an invitation and now need to answer
  Abandoned = 'abandoned',
  Completed = 'completed',
}

export enum ChildMachineState_Invitation {
  Pending = 'invitationPending',
  Sent = 'invitationSent',
}

export enum Transition_0023 {
  SendInvitation = 'Send Invitation',
  SendRequest = 'Send Request',
  SendProblemReport = 'Send Problem Report',
  ReceiveProblemReport = 'Receive Problem Report',
  SendComplete = 'Send Complete',
  SendResponse = 'Send Response',
  ReceiveResponse = 'Receive Response',
  ReceiveRequest = 'Receive Request',
  ReceiveComplete = 'Receive Complete',
  ReceiveInvitation = 'Receive Invitation',
}

export enum ErrorCodes_0023 {
  RequestNotAccepted = 'request_not_accepted',
  RequestProcessingError = 'request_processing_error',
  ResponseNotAccepted = 'response_not_accepted',
  ResponseProcessingError = 'response_processing_error',
  ProblemReport = 'problem-report',
}

const METADATA_AIP_TYPE = 'AIP_RFC'
const METADATA_AIP_STATE_MACHINE = 'AIP_STATE_MACHINE'
const METADATA_AIP_IN_RESPONSE_TO = 'AIP_IN_RESPONSE_TO'

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
export class DidExchange0023MessageHandler extends AbstractMessageHandler {
  get stateMachineConfiguration(): StateMachine<any, any, any> {
    return this._stateMachineConfiguration
  }

  private readonly _stateMachineConfiguration = createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QCUBiBhADJgTATgDpYAXAQwCdiBiZMAYzAEsA3MAAgEkA7Zxs4xgHsuAbUwBdRKAAOg2HyFcpIAB6IAjAGZMBTJvU51ADiN5TANnM4ANCACeGzABYCTvO7zn15vN-UBWIwBfINs0LFxCEgpqAGUwLghOHj5SAWExSSQQWXl0pWy1BC0dPQNjUwsrWwcEf0xCJ29LbEsncxNzELCMbHwCRhT+RQBacnomVggqCGEwAZ5BAGt5wd5h4VoGFkgAfVgEiFoARwBXOGJM5VyFYWUi-2MCAKtNAHZNI3U3pzfzGsQOHqug8njeRk0lhwwVCIHCfUIa1S+TGEx20zA5HIgnIBGkABs0gAzHEAWwW6zSii2kz2B0SJ3OJCu2Ru+XuGgMAOKhhwzwh+icejemECXVh8MiFORo3G2ymVHiiTYjIuLJkcluBVAD2hz38rw+Xx+f256ncBH8oLef3egUC3ThvSlSI2XFR8sgisObAACtiAEb4sCklVgWSUdU5TXswqIepGfWGz7fX7-eyITSaPnGLPacyYEVOJyOyX9cZnC4jenUGk7MOwWRcA5RtmKDkIPBvdSufz6PSBIxC3zcnDYVx5-tdhrmnCl53lsCVkjVhJxH3+wRBkNhiOXCTXGPtuOdmwZ4pWt4EDrZ8FuHDmN7ziKLxvCA4e2nTWZcVaLFYEOMb7NmAdZTNwzCCHQVIZAerJHncJ76P417dkOxjFtgbhmimBB4HmmBWE4hhaDCPQvoQQFNh+cpflQmLYriBLEmSgFwNRoFouBizQfkrYIdqqiZqKqEYRhQrOHgZrEY0Wb4A+BhNOK5EImxwE0VxXpKkk6CCKSBJgMQYD8Xkx46pmASiehQ4Sdh55aPoE5ZoWOCuWOnjPqpVHvmAn7ot6yqbtuoa0HuJlah2+AoY+Yk2VhUn2WmeFyeCZg4GhnkukMMHujWNCaWGy77lkGqmYh5mdv4V4eEYbx4GOBiPpo3K-ImgRyUYeg4JojzdZl-Sujlq5cLWBVBcGIXhjixWHmVglFHgVV4e4tX1ZgjUfNyRhWNeAoBOt3b+MW-WItlKI1tKbq+ocgxQDMcwUss8zRJQ+yHBBMqwSV0ZzR29SEGUfj+NCHw4L83J9joljQ1aHR6JgZFOhRbFFX5Co-n+kEARWTLEGBdKHLQ6nGXBpURSeDnmAQ4LqAj9R6ItHQQ3oTnZr4kJ4NgmglhKC6UUuuNo16DE4nihLECS5DkjjFz4xAb0MuxPnhbGFXVOeDU9vh2ZGN1j7dd4J0o4LtH+dpDYcSrZlCcUWZUzTdNc4zRgtcDyUEeo3juF4RsyyupsKvjfqBhNu7TVb5U21o3jU18jsMwaLvnj8Wt5gE9RvGOQK+0rIHDaNnpsLp+nBkZEfzYCTjRQa3XyaY9XZmaEKELm6VvL1VVOJoOfE-n+WF+NO6heHpM-eTFVg9Xrx1+4tdN6Yu23uYfZg3eISwlwggQHAyhlngs3jzbIzprUx+6Ng62uU4tVuMYy9Gy9xAH6rNvEWanuuM0KY-GYord7zyNBoogDpAZ+1sij6EaB0bs3ZPi2iMP4LaPY3CggCD1Qw20c6oxrGAyORRdYuHwNAiEY5NB4DfhrQsBAeoXyqlCYi6ge4cSFhAXBFdiiFhwtzXQAoEblHqv4I2QDRg4Pgr9E80Icw31coWdo2B1AtSeNDZeBggT6AsEIs6Ii1yXRytdRIt02EdmcvyH4MifgFnWszKmzQoRWHbpzPQmjKTnR0cI4QSon5iMPkUI014DSe3cN2XAXgIZ6iUlCPszdBEAK8gLKsIDWHeJfkUT2ZDrwNCBAjdy8lXYoXalmWm3huwBCYT5fORiTy1Sbu0EE7hzSPGblmI2dA9IGSMkksmKTEBWETMYH4tVoTqCFFmHCdVF7aCGavRGe8CCkADKQRIcxOlj26QgXppjr6Zy+CM5q9kfAuFzNmQi0IyHA3XkEIAA */
    id: 'RFC0029',
    initial: MachineState_0023.Start,
    context: {
      problemCode: undefined,
    },
    states: {
      [MachineState_0023.Start]: {
        on: {
          [Transition_0023.ReceiveInvitation]: {
            target: MachineState_0023.InvitationReceived,
          },
          [Transition_0023.SendInvitation]: {
            target: MachineState_0023.InvitationSent,
          },
        },
      },
      [MachineState_0023.InvitationReceived]: {
        // When we receive an invitation we check:
        // Do we want to respond? Is the message ok? Do we trust the other party? Done in DidExchange0023MessageHandler.sendRequest
        // If that's the case -> target the state onDone -> SendRequest which puts us in 'RequestSent'
        invoke: {
          id: 'invitationReceived_sendRequest',
          src: async (_, event) => await this.sendRequest(event),
          onDone: {
            target: MachineState_0023.RequestSent,
          },
          onError: {
            target: MachineState_0023.Abandoned,
          },
        },
        on: {
          [Transition_0023.SendRequest]: {
            target: MachineState_0023.RequestSent,
          },
          [Transition_0023.SendProblemReport]: {
            target: MachineState_0023.Abandoned,
          },
        },
      },
      [MachineState_0023.RequestSent]: {
        on: {
          [Transition_0023.ReceiveResponse]: {
            target: MachineState_0023.ResponseReceived,
          },
          [Transition_0023.SendProblemReport]: {
            target: MachineState_0023.Abandoned,
          },
        },
      },
      [MachineState_0023.ResponseReceived]: {
        invoke: {
          id: 'responseReceivedInvocation',
          src: async (_: any, event: any) => await this.sendComplete(event),
          onDone: {
            target: MachineState_0023.Completed,
          },
          onError: {
            target: MachineState_0023.Abandoned,
          },
        },
        on: {
          [Transition_0023.SendComplete]: {
            target: MachineState_0023.Completed,
          },
          [Transition_0023.SendProblemReport]: {
            target: MachineState_0023.Abandoned,
          },
        },
      },
      [MachineState_0023.InvitationSent]: {
        initial: ChildMachineState_Invitation.Pending,
        states: {
          [ChildMachineState_Invitation.Pending]: {
            invoke: {
              id: 'start_sendInvitation',
              src: async (_, event) => await this.sendInvitation(event),
              onDone: {
                target: ChildMachineState_Invitation.Sent,
              },
            },
          },
          [ChildMachineState_Invitation.Sent]: {
            type: 'final',
          },
        },
        on: {
          [Transition_0023.ReceiveRequest]: {
            target: MachineState_0023.RequestReceived,
          },
          [Transition_0023.ReceiveProblemReport]: {
            target: MachineState_0023.Abandoned,
          },
        },
      },
      [MachineState_0023.RequestReceived]: {
        invoke: {
          id: 'requestReceived_sendResponse',
          src: async (_: any, event: any) => await this.sendResponse(event),
          onDone: {
            target: MachineState_0023.ResponseSent,
          },
          onError: {
            target: MachineState_0023.Abandoned,
          },
        },
        on: {
          [Transition_0023.SendResponse]: {
            target: MachineState_0023.ResponseSent,
          },
          [Transition_0023.ReceiveProblemReport]: {
            target: MachineState_0023.Abandoned,
          },
        },
      },
      [MachineState_0023.ResponseSent]: {
        on: {
          [Transition_0023.ReceiveComplete]: {
            target: MachineState_0023.Completed,
          },
          [Transition_0023.ReceiveProblemReport]: {
            target: MachineState_0023.Abandoned,
          },
        },
      },
      [MachineState_0023.Completed]: {
        type: 'final',
      },
      [MachineState_0023.Abandoned]: {
        invoke: {
          id: 'any_sendProblemReport',
          src: (_: any, event: any) => this.sendProblemReport(event),
        },
        type: 'final',
      },
    },
    schema: {
      events: {} as
        | { type: Transition_0023.ReceiveInvitation }
        | { type: Transition_0023.SendInvitation }
        | { type: Transition_0023.ReceiveResponse }
        | { type: Transition_0023.SendRequest }
        | { type: Transition_0023.SendResponse }
        | { type: Transition_0023.SendProblemReport }
        | { type: Transition_0023.ReceiveProblemReport }
        | { type: Transition_0023.ReceiveRequest }
        | { type: Transition_0023.ReceiveComplete }
        | { type: Transition_0023.SendComplete },
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
  })

  // The function which will be called when answering to an invitation, determining if the
  // inviting did is trustworthy
  private readonly trustResolver: any

  constructor(private readonly resolver: any) {
    super()
    this.trustResolver = resolver
  }

  async handle(message: Message, context: IContext): Promise<Message> {
    // Check if this is actually a message we want to handle
    // If not, we pass the message to the next handler
    //
    // This is the only and last point we can pass the message to the next handler. If we determine this is indeed a message
    // **_this_** handler should handle, we are not passing it to the next one in case of errors.
    if (!Object.values(MESSAGE_TYPE).includes(message.data['@type'])) {
      console.log(
        `Received didcomm message of type: [${message.data['@type']}] which is not handled by DidExchange0023MessageHandler. Passing to next handler.`
      )
      return super.handle(message, context)
    }

    try {
      if (!message.threadId || !message.to || !message.from || !message.id || !message.id || !message.data) {
        throw new Error(`Incoming aries 0023 message has missing required fields for evaluation [${message}]`)
      }

      console.log(
        `Received didcomm message of type: [${message.data['@type']}] from did [${message.from}] for thread [${message.threadId}]`
      )

      const stateMachineService = interpret(this._stateMachineConfiguration)

      const messages = await context.agent.dataStoreORMGetMessages({
        // We only want to retrieve messages that are not from ourselves (as in sent by us)
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
                return metaData.value as MachineState_0023
              }
            })
            .filter((value) => value !== undefined)

          if (!!stateMetadataString) {
            // Exception if we are the inviter we have to manually advance the state to child state
            // 'invitationSent' as there is no state before sending an invitation we can 'remember' via sent messages.
            if (stateMetadataString[0] === MachineState_0023.InvitationSent) {
              stateMachineService.start({
                [MachineState_0023.InvitationSent]: 'invitationSent',
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
      console.error('Error while processing an aries 0023 message.', exception)
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
      currentState = Object.keys(machineSnapshotValue)[0] as MachineState_0023
    } else {
      currentState = machineSnapshotValue as MachineState_0023
    }

    const messageType = incomingMessage.data['@type'] as MESSAGE_TYPE

    // If we receive a request WE initiated the flow and should therefore be in the current state of InvitationSent
    if (messageType === MESSAGE_TYPE.REQUEST && currentState === MachineState_0023.InvitationSent) {
      stateMachine.send({
        type: Transition_0023.ReceiveRequest,
        message: incomingMessage,
        veramoAgent: context.agent,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0023.RequestReceived))
      return
    }

    // If we receive an invitation, we already started the machine in mode that will trigger the sending of the request.
    if (messageType === MESSAGE_TYPE.INVITATION && currentState === MachineState_0023.Start) {
      stateMachine.send({
        type: Transition_0023.ReceiveInvitation,
        message: incomingMessage,
        veramoAgent: context.agent,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0023.RequestSent))
      return
    }

    // We received a response after sending a request.
    if (messageType === MESSAGE_TYPE.RESPONSE && currentState === MachineState_0023.RequestSent) {
      stateMachine.send({
        type: Transition_0023.ReceiveResponse,
        message: incomingMessage,
        veramoAgent: context.agent,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0023.Completed))
      console.log(
        `Aries 0023 Invitation flow for invitee [${incomingMessage.to}] and didcomm threadId [${incomingMessage.threadId}] completed.`
      )
      return
    }

    // We received a complete after sending a response
    if (messageType === MESSAGE_TYPE.COMPLETE && currentState === MachineState_0023.ResponseSent) {
      stateMachine.send({ type: Transition_0023.ReceiveComplete })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0023.Completed))
      console.log(
        `Aries 0023 Invitation flow for inviter [${incomingMessage.to}] and didcomm threadId [${incomingMessage.threadId}] completed.`
      )
      return
    }

    // Always possible to receive a problem report. We then navigate the state into 'Abandoned'
    if (messageType === MESSAGE_TYPE.PROBLEM_REPORT) {
      stateMachine.send({
        type: Transition_0023.ReceiveProblemReport,
        message: incomingMessage,
        veramoAgent: context.agent,
        problem: ErrorCodes_0023.ProblemReport,
      })
      await waitFor(stateMachine, (state) => state.matches(MachineState_0023.Abandoned))
    }

    // Nothing could be determined. We send a problem report.
    return stateMachine.send({ type: Transition_0023.SendProblemReport })
  }

  // Protocol initializer
  private async sendInvitation(event: any) {
    const threadId = event.threadId
    const messageId = randomUUID()
    const fromDid = event.fromDid
    const toDid = event.toDid
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesInvitationMessage = {
      '@id': threadId,
      '@type': MESSAGE_TYPE.INVITATION,
      services: [fromDid],
    }

    const didCommMessage: IDIDCommMessage = {
      id: randomUUID(),
      from: fromDid,
      to: toDid,
      thid: threadId,
      body: ariesInvitationMessage,
      type: MESSAGE_TYPE.INVITATION,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      threadId,
      didCommMessage.body,
      'New invitation triggered by user',
      MESSAGE_TYPE.INVITATION,
      MachineState_0023.InvitationSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  // Answer to [invitation]
  private async sendRequest(event: any) {
    const veramoAgent: VeramoAgent = event.veramoAgent
    //The invitation we get in
    const invitation: Message = event.message
    // The incoming invitation message contains the did we should contact
    const toDid = invitation.data.services[0]
    const fromDid = invitation.to
    // When a request responds to an explicit invitation,
    // its ~thread.pthid MUST be equal to the @id property of the invitation as described in the out-of-band RFC.
    const parentThreadId = invitation.data['@id']
    // New Thread as we answer to an invitation and this request is a new flow
    // This is aries specific - The didcomm thread is going to keep its unique ID across the protocol for easiness
    const threadId = randomUUID()

    if (!fromDid || !invitation.to) {
      const errorMessage = 'Received invitation with missing required parameters. Not sending request.'
      console.error(errorMessage)
      throw Error(errorMessage)
    }

    const retrievedIdentifier = await veramoAgent.didManagerGet({
      did: invitation.to,
    })

    // Execute the trust check if we want to answer this did
    if (this.trustResolver !== undefined && invitation?.from) {
      const trusted = await this.trustResolver.checkTrustStatus(invitation.from)
      if (!trusted) {
        console.log(`did [${fromDid}] is not answering invitation from did [${toDid}] as it is considered not trusted`)
        return
      }
    }

    const ariesRequestMessage = {
      '@id': threadId,
      '@type': MESSAGE_TYPE.REQUEST,
      '~thread': { pthid: parentThreadId, thid: threadId },
      label: retrievedIdentifier.alias,
      //TODO: This should probably be configurable
      goal_code: 'aries.rel.build',
      goal: 'To create a trusted relationship',
      did: retrievedIdentifier.did,
    }

    const messageId = randomUUID()

    const didCommMessage = {
      type: MESSAGE_TYPE.REQUEST,
      id: messageId,
      // We can be sure this exists as the message had to be decrypted somehow
      from: fromDid,
      to: toDid,
      thid: invitation.threadId,
      body: ariesRequestMessage,
      packingType: DIDCommMessagePacking.AUTHCRYPT,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      parentThreadId,
      ariesRequestMessage,
      invitation,
      MESSAGE_TYPE.REQUEST,
      MachineState_0023.RequestSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  // Answer to [request]
  private async sendResponse(event: any) {
    //The request we receive
    const request: Message = event.message

    const fromDid = request.to

    if (fromDid === undefined) {
      throw new Error(`Incoming aries 0023 request [${request.id}] has missing required fields for evaluation `)
    }

    const didcommThreadId = request.threadId
    const ariesThreadId = request.data['~thread'].thid
    // The incoming request defines the did we should answer on
    const requestDid = request.data.did

    const messageId = randomUUID()
    const veramoAgent: VeramoAgent = event.veramoAgent

    const ariesResponseMessage = {
      '@type': MESSAGE_TYPE.RESPONSE,
      '@id': messageId,
      '~thread': {
        thid: ariesThreadId,
      },
      did: request.to,
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: requestDid,
      thid: didcommThreadId,
      body: ariesResponseMessage,
      type: MESSAGE_TYPE.RESPONSE,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      requestDid,
      didcommThreadId,
      ariesResponseMessage,
      request,
      MESSAGE_TYPE.RESPONSE,
      MachineState_0023.ResponseSent,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, requestDid, veramoAgent)
  }

  // Answer to [response]
  private async sendComplete(event: any) {
    const response: Message = event.message
    const veramoAgent: VeramoAgent = event.veramoAgent

    const toDid = response.from
    const fromDid = response.to

    if (fromDid === undefined || response.threadId === undefined || toDid === undefined) {
      throw new Error(`Incoming aries 0023 response [${response.id}] has missing required fields for evaluation`)
    }

    let requestThreadId: string | undefined

    // Determine which request we sent to properly include the thid and pthid of it into this complete message
    const messages = await veramoAgent.dataStoreORMGetMessages(
      {
        where: [
          { column: 'threadId', value: [response.threadId] },
          { column: 'from', value: [fromDid] },
        ],
        order: [{ column: 'createdAt', direction: 'DESC' }],
      },
      {} as any
    )

    // Retrieve the last request and threadId we've sent as the protocol requires the information
    // for the complete message
    //TODO: Refactor this lol
    for (const message of messages) {
      if (message.metaData) {
        for (const metaData of message.metaData) {
          if (metaData.type === METADATA_AIP_TYPE && metaData.value === MESSAGE_TYPE.REQUEST) {
            if (message.data) {
              const messageData: any = message.data
              if (messageData['~thread'].pthid) {
                requestThreadId = messageData['~thread'].pthid
              }
            }
          }
        }
      }
    }

    const didcommThreadId = response.threadId
    const ariesThreadId = response.data['~thread'].thid

    const messageId = randomUUID()

    const ariesCompleteMessage = {
      '@type': MESSAGE_TYPE.COMPLETE,
      '@id': messageId,
      '~thread': {
        thid: ariesThreadId,
        pthid: requestThreadId,
      },
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: didcommThreadId,
      body: ariesCompleteMessage,
      type: MESSAGE_TYPE.COMPLETE,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      didcommThreadId,
      ariesCompleteMessage,
      response,
      MESSAGE_TYPE.COMPLETE,
      MachineState_0023.Completed,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
  }

  // May always occur
  private async sendProblemReport(event: any) {
    const veramoAgent: VeramoAgent = event.veramoAgent
    const incomingMessage = event.incomingMessage
    const problem: ErrorCodes_0023 =
      event.problem === 'undefined' ? ErrorCodes_0023.ProblemReport : (event.problem as ErrorCodes_0023)
    const relatedMessageId = event.message.data['@id']

    const toDid = incomingMessage.from
    const fromDid = incomingMessage.to
    const didcommThreadId = incomingMessage.threadId

    if (toDid === undefined || fromDid === undefined || didcommThreadId === undefined) {
      throw new Error(`Incoming aries 0023 message [${incomingMessage.id}] has missing required fields for evaluation`)
    }

    let explainMessage
    switch (problem) {
      case ErrorCodes_0023.ProblemReport:
        explainMessage = `An unexpected error occurred while handling the message of type [${incomingMessage.type}] with id [${relatedMessageId}]`
        break
      case ErrorCodes_0023.RequestProcessingError:
        explainMessage = 'The request could not be processed due to malformed or missing properties'
        break
      case ErrorCodes_0023.ResponseProcessingError:
        explainMessage = 'The response could not be processed due to malformed or missing properties'
        break
    }

    const messageId = randomUUID()

    const ariesProblemReport = {
      '@type': MESSAGE_TYPE.PROBLEM_REPORT,
      '@id': messageId,
      '~thread': { thid: relatedMessageId },
      'problem-code': problem,
      explain: explainMessage,
    }

    const didCommMessage: IDIDCommMessage = {
      id: messageId,
      from: fromDid,
      to: toDid,
      thid: didcommThreadId,
      body: ariesProblemReport,
      type: MESSAGE_TYPE.PROBLEM_REPORT,
    }

    await this.storeMessage(
      messageId,
      fromDid,
      toDid,
      didcommThreadId,
      ariesProblemReport,
      incomingMessage,
      MESSAGE_TYPE.PROBLEM_REPORT,
      MachineState_0023.Abandoned,
      veramoAgent
    )
    await this.packAndSendMessage(didCommMessage, toDid, veramoAgent)
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
      veramoAgent
        .sendDIDCommMessage(
          {
            messageId: message.id,
            packedMessage,
            recipientDidUrl: recipientDid,
          },
          {} as any
        )
        .then(() => {
          console.debug(`[Aries 0023] Sent didcomm message of type [${message.type}] to did [${recipientDid}]`)
        })
        .catch((err) => {
          console.error(
            { err },
            `Unable to pack and send didcomm message for aries 0023 flow with threadId [${message.thid}]`
          )
          throw err
        })
    } catch (err) {
      console.error(
        { err },
        `Unable to pack and send didcomm message for aries 0023 flow with threadId [${message.thid}]`
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
    messageType: MESSAGE_TYPE,
    machineState: MachineState_0023,
    veramoAgent: VeramoAgent
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
        ],
      }

      await veramoAgent.dataStoreSaveMessage({
        message: storedMessage,
      })
    } catch (exception) {
      console.error(`Unable to save message for aries 0023 flow with threadId [${threadId}]`, exception)
      throw exception
    }
  }

  public static getMachineConfig() {
    return new this(() => {}).stateMachineConfiguration
  }
}
