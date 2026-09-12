import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleTokenRequest } from './server/token.mjs'

// Serves POST /api/token in `vite dev` so the browser never sees REACTOR_API_KEY.
const tokenRoute = (env: Record<string, string>): Plugin => ({
  name: 'neurogrid-token-route',
  configureServer(server) {
    server.middlewares.use('/api/token', (req, res) =>
      handleTokenRequest(req, res, {
        apiKey: env.REACTOR_API_KEY,
        modelName: env.VITE_REACTOR_MODEL,
      }),
    )
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), tokenRoute(env)],
    // Pre-bundling the SDK breaks its `new URL('./reactor_wasm_bg.wasm', import.meta.url)` loader.
    optimizeDeps: {
      exclude: ['@reactor-team/js-sdk'],
      include: ['@reactor-team/js-sdk > awaitqueue'],
    },
  }
})
