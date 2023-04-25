// noinspection ES6PreferShortImport
import { interpret } from 'xstate'
import { randomUUID } from 'crypto'
import { VeramoAgent } from '../../src/types/IAriesRFCsPlugin'
import { waitFor } from 'xstate/lib/waitFor'
import { TAgent, IMessageHandler } from '@veramo/core'
import { IAriesRFCsPlugin } from '../../src/types/IAriesRFCsPlugin'
import {
  IssueCredential0453MessageHandler,
  Transition_0453,
  MachineState_0453,
  ChildMachineState_Offer,
  ChildMachineState_Request,
} from '../../src/handlers/0453-issue-credential-v2.handler'

import { jest } from '@jest/globals'
import { getRandomString } from '../utils/utils'

type ConfiguredAgent = TAgent<IAriesRFCsPlugin & IMessageHandler>

export default (testContext: {
  getAgent: () => ConfiguredAgent
  setup: () => Promise<boolean>
  tearDown: () => Promise<boolean>
}) => {
  describe('issue credential v2 aries exchange 0453', () => {
    const aries0453Machine = interpret(IssueCredential0453MessageHandler.getMachineConfig())

    const sendOfferMock = jest
      .spyOn(IssueCredential0453MessageHandler.prototype as any, 'sendOffer')
      .mockImplementation(() => Promise.resolve())
    const sendRequestMock = jest
      .spyOn(IssueCredential0453MessageHandler.prototype as any, 'sendRequest')
      .mockImplementation(() => Promise.resolve())
    const issueCredentialMock = jest
      .spyOn(IssueCredential0453MessageHandler.prototype as any, 'issueCredential')
      .mockImplementation(() => Promise.resolve())
    const receiveCredentialAndSendAckMock = jest
      .spyOn(IssueCredential0453MessageHandler.prototype as any, 'receiveCredentialAndSendAck')
      .mockImplementation(() => Promise.resolve())
    const sendProblemReport = jest
      .spyOn(IssueCredential0453MessageHandler.prototype as any, 'sendProblemReport')
      .mockImplementation(() => Promise.resolve())
    const storeReceivedMessages = jest
      .spyOn(IssueCredential0453MessageHandler.prototype as any, 'storeReceivedMessages')
      .mockImplementation(() => Promise.resolve())

    const veramoAgentMock = {
      packDIDCommMessage: jest.fn(),
      sendDIDCommMessage: jest.fn(),
    } as unknown as VeramoAgent

    afterEach(() => {
      jest.resetAllMocks()
      aries0453Machine.stop()
    })

    it('should [send offer] on [start]', async () => {
      aries0453Machine.start()

      aries0453Machine.send({
        type: Transition_0453.SendOffer,
        fromDid: getRandomString(),
        toDid: getRandomString(),
        threadId: randomUUID(),
        message: 'test for sending credential offer',
        veramoAgent: veramoAgentMock,
      })

      expect(sendOfferMock).toHaveBeenCalled()
      await waitFor(
        aries0453Machine,
        (state) => state.matches({ [MachineState_0453.OfferSent]: [ChildMachineState_Offer.Sent] }),
        {
          timeout: 1000,
        }
      )

      expect(aries0453Machine.getSnapshot().value).toEqual({
        [MachineState_0453.OfferSent]: ChildMachineState_Offer.Sent,
      })
    })

    it('should [send request] on [receive offer]', async () => {
      aries0453Machine.start()
      jest
        .spyOn(IssueCredential0453MessageHandler.prototype as any, 'sendRequest')
        .mockImplementation(() => Promise.resolve())
      aries0453Machine.send({
        type: Transition_0453.ReceiveOffer,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0453Machine, (state) => state.matches(MachineState_0453.RequestSent), { timeout: 1000 })

      expect(sendRequestMock).toHaveBeenCalledTimes(1)
      expect(aries0453Machine.getSnapshot().value).toEqual({
        [MachineState_0453.RequestSent]: ChildMachineState_Request.Sent,
      })
    })

    it('should [issue credential] on [receive request]', async () => {
      aries0453Machine.start(MachineState_0453.OfferSent)
      jest
        .spyOn(IssueCredential0453MessageHandler.prototype as any, 'issueCredential')
        .mockImplementation(() => Promise.resolve())
      aries0453Machine.send({
        type: Transition_0453.ReceiveRequest,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0453Machine, (state) => state.matches(MachineState_0453.CredentialIssued), { timeout: 1000 })

      expect(issueCredentialMock).toHaveBeenCalled()
      expect(aries0453Machine.getSnapshot().value).toEqual(MachineState_0453.CredentialIssued)
    })

    it('should [save credential] on Receive Credential', async () => {
      aries0453Machine.start(MachineState_0453.RequestSent)
      jest
        .spyOn(IssueCredential0453MessageHandler.prototype as any, 'receiveCredentialAndSendAck')
        .mockImplementation(() => Promise.resolve())
      aries0453Machine.send({
        type: Transition_0453.ReceiveCredential,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })
      await waitFor(aries0453Machine, (state) => state.matches(MachineState_0453.Complete), { timeout: 1000 })

      expect(receiveCredentialAndSendAckMock).toHaveBeenCalled()
      expect(aries0453Machine.getSnapshot().value).toEqual(MachineState_0453.Complete)
    })

    it('should send problem report on Offer Credential', async () => {
      aries0453Machine.start()

      const sendProblemReportOnOfferMock = jest
        .spyOn(IssueCredential0453MessageHandler.prototype as any, 'sendRequest')
        .mockImplementation(() => Promise.reject())

      jest
        .spyOn(IssueCredential0453MessageHandler.prototype as any, 'sendProblemReport')
        .mockImplementation(() => Promise.resolve())

      aries0453Machine.send({
        type: Transition_0453.ReceiveOffer,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0453Machine, (state) => state.matches(MachineState_0453.Abandoned), { timeout: 1000 })

      expect(sendProblemReportOnOfferMock).toHaveBeenCalled()
      expect(sendProblemReport).toHaveBeenCalled()
      expect(aries0453Machine.getSnapshot().value).toEqual(MachineState_0453.Abandoned)
    })

    it('should save problem report on receiveReport', async () => {
      aries0453Machine.start(MachineState_0453.OfferSent)
      jest
        .spyOn(IssueCredential0453MessageHandler.prototype as any, 'storeReceivedMessages')
        .mockImplementation(() => Promise.resolve())
      aries0453Machine.send({
        type: Transition_0453.ReceiveProblemReport,
        message: {} as any,
        veramoAgent: veramoAgentMock,
      })

      await waitFor(aries0453Machine, (state) => state.matches(MachineState_0453.Abandoned), { timeout: 1000 })

      expect(storeReceivedMessages).toHaveBeenCalled()
      expect(aries0453Machine.getSnapshot().value).toEqual(MachineState_0453.Abandoned)
    })
  })
}
