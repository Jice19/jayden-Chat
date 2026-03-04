import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../../util/password'
import { signToken } from '../../util/jwt'

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

  const token = await signToken({ sub: user.id, username: user.username })

  return {
    code: 200,
    success: true,
    message: '登录成功',
    data: { token, username: user.username }
  }
})
