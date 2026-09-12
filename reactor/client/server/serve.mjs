// Minimal production server: static `dist/` plus the POST /api/token route.
//   npm run build && REACTOR_API_KEY=rk_... VITE_REACTOR_MODEL=<acct>/neurogrid npm start
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { handleTokenRequest } from './token.mjs'

const DIST = new URL('../dist/', import.meta.url).pathname
const PORT = Number(process.env.PORT ?? 3000)
const MIME = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
})

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/api/token') {
    void handleTokenRequest(req, res, {
      apiKey: process.env.REACTOR_API_KEY,
      modelName: process.env.VITE_REACTOR_MODEL,
    })
    return
  }
  let file = join(DIST, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''))
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
  createReadStream(file).pipe(res)
}).listen(PORT, () => {
  console.log(`NeuroGrid client on http://localhost:${PORT}`)
})
