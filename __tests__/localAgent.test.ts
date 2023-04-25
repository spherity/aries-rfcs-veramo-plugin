import { getConfig } from '@veramo/cli/build/setup'
import { createObjects } from '@veramo/cli/build/lib/objectCreator'
import { DataSource } from 'typeorm'
import fs from 'fs'
import { jest } from '@jest/globals'

jest.setTimeout(30000)

// Shared tests
import myPluginLogic from './shared/Aries0023Logic'
import myPluginEventsLogic from './shared/myPluginEventsLogic'
import Aries0023HandlerLogic from './shared/Aries0023HandlerLogic'
import Aries0023Logic from './shared/Aries0023Logic'
import Aries0453Logic from './shared/Aries0453Logic'
import Aries0454Logic from './shared/Aries0454Logic'
import Aries0453HandlerLogic from './shared/Aries0453HandlerLogic'
import Aries0454HandlerLogic from './shared/Aries0454HandlerLogic'

let dbConnection: DataSource
let agent: any

const setup = async (): Promise<boolean> => {
  const config = await getConfig('./agent.yml')

  const { localAgent, db } = await createObjects(config, { localAgent: '/agent', db: '/dbConnection' })
  agent = localAgent
  dbConnection = db

  return true
}

const tearDown = async (): Promise<boolean> => {
  try {
    await dbConnection.dropDatabase()
    await dbConnection.destroy()
    fs.unlinkSync('./database.sqlite')
  } catch (e: any) {
    // nop
  }
  return true
}

const getAgent = () => agent

const testContext = { getAgent, setup, tearDown }

describe('Local integration tests', () => {
  Aries0023Logic(testContext)
  Aries0453Logic(testContext)
  Aries0454Logic(testContext)
  Aries0023HandlerLogic(testContext)
  Aries0453HandlerLogic(testContext)
  Aries0454HandlerLogic(testContext)
})
