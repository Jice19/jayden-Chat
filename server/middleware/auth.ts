import { verifyAccessToken } from '../util/jwt'

// 无需认证的公开路由
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout'
]

export default defineEventHandler(async (event) => {
  const path = event.path

  // 只拦截 /api/* 路由
  if (!path.startsWith('/api/')) return

  // 公开路由放行
  if (PUBLIC_ROUTES.some(r => path.startsWith(r))) return

  const authHeader = getHeader(event, 'authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const cookieToken = getCookie(event, 'token') || ''
  const token = bearerToken || cookieToken

  if (!token) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }

  try {
    const payload = await verifyAccessToken(token)
    // 将用户信息注入上下文，后续 handler 可直接使用
    event.context.user = payload
  } catch {
    throw createError({ statusCode: 401, message: 'Token 已过期，请重新登录' })
  }
})
