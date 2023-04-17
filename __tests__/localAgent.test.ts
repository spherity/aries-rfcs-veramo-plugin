import { getConfig } from '@veramo/cli/build/setup'
import { createObjects } from '@veramo/cli/build/lib/objectCreator'
import { DataSource } from 'typeorm'
import fs from 'fs'
import { jest } from '@jest/globals'

jest.setTimeout(30000)

// Shared tests
import myPluginLogic from './shared/myPluginLogic'
import myPluginEventsLogic from './shared/myPluginEventsLogic'

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
  myPluginLogic(testContext)
  myPluginEventsLogic(testContext)
})
