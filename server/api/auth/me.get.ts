// 验证 token 并返回当前用户信息（用于刷新页面时恢复登录态）
export default defineEventHandler(async (event) => {
  const user = event.context.user
  return {
    code: 200,
    success: true,
    data: { username: user.username, userId: user.sub }
  }
})
