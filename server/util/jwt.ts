import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'jayden-chat-secret-change-in-prod-32chars'
)

const ACCESS_TOKEN_EXPIRES_IN = '2h'
const REFRESH_TOKEN_EXPIRES_IN = '7d'

export interface JwtPayload {
  sub: string   // userId
  username: string
  type?: 'access' | 'refresh'
}

export const signToken = async (payload: JwtPayload): Promise<string> => {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
    .sign(SECRET)
}

export const signRefreshToken = async (payload: JwtPayload): Promise<string> => {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRES_IN)
    .sign(SECRET)
}

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  const { payload } = await jwtVerify(token, SECRET)
  return payload as unknown as JwtPayload
}
