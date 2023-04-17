// noinspection ES6PreferShortImport

import { TAgent, IMessageHandler } from '@veramo/core-types'
import { IMyAgentPlugin } from '../../src/types/IMyAgentPlugin.js'

type ConfiguredAgent = TAgent<IMyAgentPlugin & IMessageHandler>

export default (testContext: {
  getAgent: () => ConfiguredAgent
  setup: () => Promise<boolean>
  tearDown: () => Promise<boolean>
}) => {
  describe('my plugin', () => {
    let agent: ConfiguredAgent

    beforeAll(async () => {
      await testContext.setup()
      agent = testContext.getAgent()
    })
    afterAll(async () => {
      await testContext.tearDown()
    })

    it('should foo', async () => {
      const result = await agent.myPluginFoo({
        did: 'did:ethr:goerli:0xb09b66026ba5909a7cfe99b76875431d2b8d5190',
        foo: 'lorem',
        bar: 'ipsum',
      })
      expect(result).toEqual({ foobar: 'ipsum' })
    })
  })
}
