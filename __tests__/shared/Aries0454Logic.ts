// noinspection ES6PreferShortImport
import { interpret } from 'xstate'
import { randomUUID } from 'crypto'
import { VeramoAgent } from '../../src/types/VeramoAgent'
import { waitFor } from 'xstate/lib/waitFor'
import { TAgent, IMessageHandler } from '@veramo/core'
import {
  PresentProof0454MessageHandler,
  Transition_0454,
  MachineState_0454,
  ChildMachineState_Request,
} from '../../src/handlers/0454-present-proof-v2.handler'

import { jest } from '@jest/globals'
import { getRandomString } from '../utils/utils'
import { IAriesRFCsPlugin } from '../../src/types/IAriesRFCsPlugin'

type ConfiguredAgent = TAgent<IAriesRFCsPlugin & IMessageHandler>

export default (testContext: {
  getAgent: () => ConfiguredAgent
  setup: () => Promise<boolean>
  tearDown: () => Promise<boolean>
}) => {
  describe('present proof v2 aries exchange 0454', () => {
    const aries0454Machine = interpret(PresentProof0454MessageHandler.getMachineConfig())

    const sendRequestMock = jest
      .spyOn(PresentProof0454MessageHandler.prototype as any, 'sendRequest')
      .mockImplementation(() => Promise.resolve())
    const sendPresentationMock = jest
      .spyOn(PresentProof0454MessageHandler.prototype as any, 'sendPresentation')
      .mockImplementation(() => Promise.resolve())
    const receivePresentationMock = jest
      .spyOn(PresentProof0454MessageHandler.prototype as any, 'receivePresentation')
      .mockImplementation(() => Promise.resolve())
    const receiveAck = jest
      .spyOn(PresentProof0454MessageHandler.prototype as any, 'receiveAck')
      .mockImplementation(() => Promise.resolve())
    const sendProblemReport = jest
      .spyOn(PresentProof0454MessageHandler.prototype as any, 'sendProblemReport')
      .mockImplementation(() => Promise.resolve())
    const storeReceivedMessages = jest
      .spyOn(PresentProof0454MessageHandler.prototype as any, 'receiveProblemReport')
      .mockImplementation(() => Promise.resolve())

    const veramoAgentMock = {
      packDIDCommMessage: jest.fn(),
      sendDIDCommMessage: jest.fn(),
    } as unknown as VeramoAgent

    afterEach(() => {
      jest.resetAllMocks()
      aries0454Machine.stop()
    })

    it('should [send request] on [start]', async () => {
      aries0454Machine.start()
      jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'sendRequest')
        .mockImplementation(() => Promise.resolve())

      aries0454Machine.send({
        type: Transition_0454.SendRequest,
        fromDid: getRandomString(),
        toDid: getRandomString(),
        threadId: randomUUID(),
        message: 'test for sending presentation request',
        veramoAgent: veramoAgentMock,
      })

      expect(sendRequestMock).toHaveBeenCalled()
      await waitFor(
        aries0454Machine,
        (state) => state.matches({ [MachineState_0454.RequestSent]: [ChildMachineState_Request.Sent] }),
        {
          timeout: 1000,
        }
      )

      expect(aries0454Machine.getSnapshot().value).toEqual({
        [MachineState_0454.RequestSent]: ChildMachineState_Request.Sent,
      })
    }, 2000)

    it('should [send presentation] on [receive request]', async () => {
      aries0454Machine.start()
      jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'sendPresentation')
        .mockImplementation(() => Promise.resolve())

      aries0454Machine.send({
        type: Transition_0454.ReceiveRequest,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0454Machine, (state) => state.matches(MachineState_0454.PresentationSent), { timeout: 3000 })

      expect(sendPresentationMock).toHaveBeenCalledTimes(1)
      expect(aries0454Machine.getSnapshot().value).toEqual(MachineState_0454.PresentationSent)
    })

    it('should [save presentation] on [receive presentation]', async () => {
      aries0454Machine.start(MachineState_0454.RequestSent)
      jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'receivePresentation')
        .mockImplementation(() => Promise.resolve())
      aries0454Machine.send({
        type: Transition_0454.ReceivePresentation,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0454Machine, (state) => state.matches(MachineState_0454.PresentationReceived), {
        timeout: 2000,
      })

      expect(receivePresentationMock).toHaveBeenCalled()
      expect(aries0454Machine.getSnapshot().value).toEqual(MachineState_0454.PresentationReceived)
    })

    it('should save ack on Receive Ack', async () => {
      aries0454Machine.start(MachineState_0454.PresentationSent)
      jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'receiveAck')
        .mockImplementation(() => Promise.resolve())
      aries0454Machine.send({
        type: Transition_0454.ReceiveAck,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })
      await waitFor(aries0454Machine, (state) => state.matches(MachineState_0454.Done), { timeout: 2000 })

      expect(receiveAck).toHaveBeenCalled()
      expect(aries0454Machine.getSnapshot().value).toEqual(MachineState_0454.Done)
    })

    it('should send problem report on receive presentation', async () => {
      aries0454Machine.start(MachineState_0454.RequestSent)

      const sendProblemReportVerifyMock = jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'receivePresentation')
        .mockImplementation(() => Promise.reject())

      jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'sendProblemReport')
        .mockImplementation(() => Promise.resolve())

      aries0454Machine.send({
        type: Transition_0454.ReceivePresentation,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0454Machine, (state) => state.matches(MachineState_0454.Abandoned), { timeout: 3000 })

      expect(sendProblemReportVerifyMock).toHaveBeenCalled()
      expect(sendProblemReport).toHaveBeenCalled()
      expect(aries0454Machine.getSnapshot().value).toEqual(MachineState_0454.Abandoned)
    })

    it('should save problem report on receiveReport', async () => {
      aries0454Machine.start(MachineState_0454.PresentationSent)
      jest
        .spyOn(PresentProof0454MessageHandler.prototype as any, 'receiveProblemReport')
        .mockImplementation(() => Promise.resolve())
      aries0454Machine.send({
        type: Transition_0454.ReceiveProblemReport,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0454Machine, (state) => state.matches(MachineState_0454.Abandoned), { timeout: 2000 })

      expect(storeReceivedMessages).toHaveBeenCalled()
      expect(aries0454Machine.getSnapshot().value).toEqual(MachineState_0454.Abandoned)
    })
  })
}
