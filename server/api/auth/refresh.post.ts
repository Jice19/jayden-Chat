import { verifyRefreshToken, signToken, signRefreshToken } from '../../util/jwt'

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'refresh_token')

  if (!refreshToken) {
    throw createError({ statusCode: 400, message: 'Refresh Token 不能为空' })
  }

  try {
    const payload = await verifyRefreshToken(refreshToken)

    // 生成新的 Access Token 和 Refresh Token (可选，通常 Refresh Token 也可以续期)
    const newAccessToken = await signToken({ sub: payload.sub, username: payload.username })
    const newRefreshToken = await signRefreshToken({ sub: payload.sub, username: payload.username })

    setCookie(event, 'refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600
    })

    setCookie(event, 'token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 2 * 3600
    })

    return {
      success: true,
      data: {}
    }
  } catch (e) {
    throw createError({ statusCode: 401, message: 'Refresh Token 已过期或无效，请重新登录' })
  }
})
