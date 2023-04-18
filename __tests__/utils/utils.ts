import { randomBytes } from 'crypto'

export const getRandomString = () => randomBytes(16).toString('hex')
