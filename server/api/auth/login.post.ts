import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../../util/password'
import { signToken, signRefreshToken } from '../../util/jwt'

const prisma = (global as any).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma

export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' })
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  const accessToken = await signToken({ sub: user.id, username: user.username })
  const refreshToken = await signRefreshToken({ sub: user.id, username: user.username })

  setCookie(event, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600
  })

  setCookie(event, 'token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 3600
  })

  return {
    code: 200,
    success: true,
    message: '登录成功',
    data: { username: user.username }
  }
})
