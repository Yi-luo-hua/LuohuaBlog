import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const aiAssistantDir = join(repoRoot, 'shared', 'ai-assistant')

function aiAssistantDevAssets() {
  return {
    name: 'ai-assistant-dev-assets',
    configureServer(server) {
      server.middlewares.use('/ai-assistant', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const filePath = normalize(join(aiAssistantDir, urlPath))
        if (!filePath.startsWith(aiAssistantDir) || !existsSync(filePath)) {
          next()
          return
        }
        const contentType = extname(filePath) === '.css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8'
        res.setHeader('Content-Type', contentType)
        createReadStream(filePath).pipe(res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aiAssistantDevAssets()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
})
