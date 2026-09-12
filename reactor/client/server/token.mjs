// Exchanges the server-side REACTOR_API_KEY for a short-lived, model-scoped
// JWT (POST https://api.reactor.inc/tokens). Shared by the Vite dev
// middleware and the production server so the key never reaches the browser.

const TOKENS_URL = 'https://api.reactor.inc/tokens'

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ apiKey?: string; modelName?: string }} options
 */
export async function handleTokenRequest(req, res, options) {
  const send = (/** @type {number} */ status, /** @type {unknown} */ body) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }

  if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })
  if (!options.apiKey) {
    return send(503, {
      error: 'no_api_key',
      detail: 'REACTOR_API_KEY is not set on the server (local mode needs no token).',
    })
  }
  if (!options.modelName) return send(500, { error: 'no_model_name' })

  try {
    const upstream = await fetch(TOKENS_URL, {
      method: 'POST',
      headers: {
        'Reactor-API-Key': options.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_details: [
          { type: 'session', resources: { models: { match: [options.modelName] } } },
        ],
      }),
    })
    const payload = /** @type {{ jwt?: string }} */ (await upstream.json())
    if (!upstream.ok || !payload.jwt) {
      return send(upstream.status || 502, { error: 'token_exchange_failed', detail: payload })
    }
    return send(200, { jwt: payload.jwt })
  } catch (error) {
    return send(502, { error: 'token_exchange_failed', detail: String(error) })
  }
}
