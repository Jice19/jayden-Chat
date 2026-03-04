/**
 * 从 Nuxt runtime config 读取并清洗阿里云 API Key。
 * 统一处理中文引号、首尾引号、非可见 ASCII 字符等常见污染问题。
 */
export function getApiKey(): string {
  const config = useRuntimeConfig()
  const apiKey = String(config.aliyunApiKey)
    .trim()
    .replace(/[""]/g, '"')
    .replace(/^"+|"+$/g, '')
    .replace(/[^\x20-\x7E]/g, '')

  if (!apiKey) {
    throw new Error('阿里云 API Key 未配置，请检查环境变量 ALIYUN_API_KEY')
  }

  return apiKey
}
