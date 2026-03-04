import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'jayden-chat-secret-change-in-prod-32chars'
)

const EXPIRES_IN = '7d'

export interface JwtPayload {
  sub: string   // userId
  username: string
}

export const signToken = async (payload: JwtPayload): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  const { payload } = await jwtVerify(token, SECRET)
  return payload as unknown as JwtPayload
}
