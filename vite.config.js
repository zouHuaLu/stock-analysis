import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/em-quote': {
        target: 'https://push2.eastmoney.com',
        changeOrigin: true,
        headers: {
          Referer: 'https://quote.eastmoney.com/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
        },
        rewrite: (path) => path.replace(/^\/em-quote/, ''),
      },
      '/em-history': {
        target: 'https://push2his.eastmoney.com',
        changeOrigin: true,
        headers: {
          Referer: 'https://quote.eastmoney.com/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
        },
        rewrite: (path) => path.replace(/^\/em-history/, ''),
      },
      '/tencent-stock': {
        target: 'https://web.ifzq.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tencent-stock/, ''),
      },
      '/em-search': {
        target: 'https://search-api-web.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/em-search/, ''),
      },
    },
  },
})
