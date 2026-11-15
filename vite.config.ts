import { copyFileSync } from 'node:fs'
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// 生成 404.html，适配 GitHub Pages 等静态托管服务的 SPA 深层路由回退
const spa404Fallback = {
  name: 'spa-404-fallback',
  closeBundle() {
    const distDir = path.resolve(__dirname, 'dist')
    copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'))
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), spa404Fallback],
  server: {
    port: 3000,
  },
  optimizeDeps: {
    // 预构建 Excel 解析库，避免首次懒加载时 Vite 重新优化依赖导致页面刷新
    include: ['xlsx-js-style'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // xlsx 解析库本身约 900 kB，单独分包后允许其超过默认 500 kB 提示线
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx-js-style'],
        },
      },
    },
  },
});
