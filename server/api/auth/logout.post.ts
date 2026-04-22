export default defineEventHandler(async (event) => {
  const isProduction = process.env.NODE_ENV === 'production'

  setCookie(event, 'token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })

  setCookie(event, 'refresh_token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })

  return {
    code: 200,
    success: true,
    message: '退出登录成功',
    data: {}
  }
})
