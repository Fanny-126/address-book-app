import { copyFileSync, mkdirSync } from 'node:fs'
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// 静态托管只能按文件路径匹配，无法像 Nginx 那样做 try_files 回退。
// 构建时为每个前端路由生成入口文件，并额外生成 404.html，保证直接访问与刷新可用。
const STATIC_ROUTES = ['contacts', 'contacts/new', 'favorites', 'import-export', 'excel']

const spaStaticRoutes = {
  name: 'spa-static-routes',
  closeBundle() {
    const distDir = path.resolve(__dirname, 'dist')
    const indexFile = path.join(distDir, 'index.html')
    copyFileSync(indexFile, path.join(distDir, '404.html'))
    for (const route of STATIC_ROUTES) {
      const routeDir = path.join(distDir, route)
      mkdirSync(routeDir, { recursive: true })
      copyFileSync(indexFile, path.join(routeDir, 'index.html'))
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  // 静态托管需要绝对资源路径，否则 /contacts/ 下的相对路径会指向 /contacts/assets
  base: '/',
  plugins: [inspectAttr(), react(), spaStaticRoutes],
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
