import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../../util/password'
import { signToken } from '../../util/jwt'

const prisma = (global as any).prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') (global as any).prisma = prisma

export default defineEventHandler(async (event) => {
  const { username, password } = await readBody(event)

  if (!username || !password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' })
  }
  if (username.length < 2 || username.length > 20) {
    throw createError({ statusCode: 400, message: '用户名长度 2~20 个字符' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: '密码至少 6 位' })
  }

  const exists = await prisma.user.findUnique({ where: { username } })
  if (exists) {
    throw createError({ statusCode: 409, message: '用户名已存在' })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { username, passwordHash }
  })

  const token = await signToken({ sub: user.id, username: user.username })

  return {
    code: 200,
    success: true,
    message: '注册成功',
    data: { token, username: user.username }
  }
})
