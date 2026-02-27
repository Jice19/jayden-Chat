// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    aliyunApiKey: process.env.ALIYUN_API_KEY || '',
    // 客户端不暴露任何敏感信息
    public: {}
  },
  postcss: {
    plugins: {
      '@tailwindcss/postcss': { config: './tailwind.config.js' },
      autoprefixer: {}
    }
  },
})
