// noinspection ES6PreferShortImport

import 'cross-fetch/polyfill'
import { IAgent, createAgent, IAgentOptions, IMessageHandler } from '@veramo/core'
import { DataSource } from 'typeorm'
import { AgentRestClient } from '@veramo/remote-client'
import express from 'express'
import { Server } from 'http'
import { AgentRouter, RequestWithAgentRouter } from '@veramo/remote-server'
import { getConfig } from '@veramo/cli/build/setup'
import { createObjects } from '@veramo/cli/build/lib/objectCreator'
import fs from 'fs'
import { jest } from '@jest/globals'

jest.setTimeout(30000)

import { IAriesRFCsPlugin } from '../src/types/IAriesRFCsPlugin'
import Aries0023Logic from './shared/Aries0023Logic'
import Aries0453Logic from './shared/Aries0453Logic'
import Aries0454Logic from './shared/Aries0454Logic'
import Aries0023HandlerLogic from './shared/Aries0023HandlerLogic'
import Aries0453HandlerLogic from './shared/Aries0453HandlerLogic'
import Aries0454HandlerLogic from './shared/Aries0454HandlerLogic'
// Shared tests

const databaseFile = 'rest-database.sqlite'
const port = 3002
const basePath = '/agent'

let serverAgent: IAgent
let restServer: Server
let dbConnection: DataSource

const getAgent = (options?: IAgentOptions) =>
  createAgent<IAriesRFCsPlugin & IMessageHandler>({
    ...options,
    plugins: [
      new AgentRestClient({
        url: 'http://localhost:' + port + basePath,
        enabledMethods: serverAgent.availableMethods(),
        schema: serverAgent.getSchema(),
      }),
    ],
  })

const setup = async (options?: IAgentOptions): Promise<boolean> => {
  const config = await getConfig('./agent.yml')
  config.constants.databaseFile = databaseFile
  const { agent, db } = await createObjects(config, { agent: '/agent', db: '/dbConnection' })
  serverAgent = agent
  dbConnection = db

  const agentRouter = AgentRouter({
    exposedMethods: serverAgent.availableMethods(),
  })

  const requestWithAgent = RequestWithAgentRouter({
    agent: serverAgent,
  })

  return new Promise((resolve) => {
    const app = express()
    app.use(basePath, requestWithAgent, agentRouter)
    restServer = app.listen(port, () => {
      resolve(true)
    })
  })
}

const tearDown = async (): Promise<boolean> => {
  try {
    await new Promise((resolve, reject) => {
      restServer.close((err) => (err ? reject(err) : resolve(null)))
    })
    await dbConnection.dropDatabase()
    await dbConnection.destroy()
    fs.unlinkSync(databaseFile)
  } catch (e: any) {
    // nop
  }
  return true
}

const testContext = { getAgent, setup, tearDown }

describe('REST integration tests', () => {
  Aries0023Logic(testContext)
  Aries0453Logic(testContext)
  Aries0454Logic(testContext)
  Aries0023HandlerLogic(testContext)
  Aries0453HandlerLogic(testContext)
  Aries0454HandlerLogic(testContext)
})
