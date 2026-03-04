import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)
const KEYLEN = 64

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const [salt, storedKey] = hash.split(':')
  if (!salt || !storedKey) return false
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer
  const storedBuffer = Buffer.from(storedKey, 'hex')
  return derived.length === storedBuffer.length && timingSafeEqual(derived, storedBuffer)
}
