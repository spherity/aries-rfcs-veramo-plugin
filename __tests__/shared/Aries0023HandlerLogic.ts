/* istanbul ignore file */
import {
  ChildMachineState_Invitation,
  DidExchange0023MessageHandler,
  MachineState_0023,
  Transition_0023,
} from '../../src/handlers/0023-did-exchange.handler'
import { interpret } from 'xstate'
import { randomUUID } from 'crypto'
import { VeramoAgent } from '../../src/types/VeramoAgent'
import { waitFor } from 'xstate/lib/waitFor'

import { TAgent, IMessageHandler } from '@veramo/core'
import { IAriesRFCsPlugin } from '../../src/types/IAriesRFCsPlugin'

import { jest } from '@jest/globals'

type ConfiguredAgent = TAgent<IAriesRFCsPlugin & IMessageHandler>

export default (testContext: {
  getAgent: () => ConfiguredAgent
  setup: () => Promise<boolean>
  tearDown: () => Promise<boolean>
}) => {
  describe('didcomm aries exchange 0023', () => {
    const aries0023Machine = interpret(
      new DidExchange0023MessageHandler({
        async checkTrustStatus(did: string): Promise<boolean> {
          return true
        },
      }).stateMachineConfiguration
    )
    const sendInvitationMock = jest
      .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendInvitation')
      .mockImplementation(() => Promise.resolve())
    const sendRequestMock = jest
      .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendRequest')
      .mockImplementation(() => Promise.resolve())
    const sendResponseMock = jest
      .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendResponse')
      .mockImplementation(() => Promise.resolve())
    const sendCompleteMock = jest
      .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendComplete')
      .mockImplementation(() => Promise.resolve())

    const veramoAgentMock = {
      packDIDCommMessage: jest.fn(),
      sendDIDCommMessage: jest.fn(),
    } as unknown as VeramoAgent

    afterEach(() => {
      aries0023Machine.stop()
    })

    it('should [send invitation] on [start]', async () => {
      aries0023Machine.start()
      jest
        .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendInvitation')
        .mockImplementation(() => Promise.resolve())

      aries0023Machine.send({
        type: Transition_0023.SendInvitation,
        fromDid: 'did:test:alice',
        toDid: 'did:test:bob',
        threadId: randomUUID(),
        veramoAgent: veramoAgentMock,
      })

      expect(sendInvitationMock).toHaveBeenCalled()
      await waitFor(
        aries0023Machine,
        (state) => state.matches({ [MachineState_0023.InvitationSent]: [ChildMachineState_Invitation.Sent] }),
        {
          timeout: 1000,
        }
      )

      expect(aries0023Machine.getSnapshot().value).toEqual({
        [MachineState_0023.InvitationSent]: ChildMachineState_Invitation.Sent,
      })
    })

    it('should [send request] on [receive invitation]', async () => {
      aries0023Machine.start()
      jest
        .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendRequest')
        .mockImplementation(() => Promise.resolve())
      aries0023Machine.send({
        type: Transition_0023.ReceiveInvitation,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })
      await waitFor(aries0023Machine, (state) => state.matches(MachineState_0023.RequestSent), { timeout: 1000 })

      expect(sendRequestMock).toHaveBeenCalled()
      expect(aries0023Machine.getSnapshot().value).toEqual(MachineState_0023.RequestSent)
    })

    it('should [send response] on [receive request]', async () => {
      aries0023Machine.start(MachineState_0023.InvitationSent)
      jest
        .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendResponse')
        .mockImplementation(() => Promise.resolve())
      aries0023Machine.send({
        type: Transition_0023.ReceiveRequest,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })
      await waitFor(aries0023Machine, (state) => state.matches(MachineState_0023.ResponseSent), { timeout: 1000 })

      expect(sendResponseMock).toHaveBeenCalled()
      expect(aries0023Machine.getSnapshot().value).toEqual(MachineState_0023.ResponseSent)
    })

    it('should [send complete] on [receive response]', async () => {
      aries0023Machine.start(MachineState_0023.RequestSent)
      jest
        .spyOn(DidExchange0023MessageHandler.prototype as any, 'sendComplete')
        .mockImplementation(() => Promise.resolve())
      aries0023Machine.send({
        type: Transition_0023.ReceiveResponse,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })
      await waitFor(aries0023Machine, (state) => state.matches(MachineState_0023.Completed), { timeout: 1000 })

      expect(sendCompleteMock).toHaveBeenCalled()
      expect(aries0023Machine.getSnapshot().value).toEqual(MachineState_0023.Completed)
    })
  })
}
