import http from 'node:http'
import process from 'node:process'
import { handleSiteApi, initializeSiteApi, sendJson } from './site-api.mjs'

const port = Number(process.env.PORT || 8080)
const host = process.env.HOST || '0.0.0.0'

await initializeSiteApi(process.env)

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname

  if (!pathname.startsWith('/api/')) {
    sendJson(response, 404, { ok: false, message: 'Not found.' })
    return
  }

  try {
    const handled = await handleSiteApi(request, response, pathname, process.env)
    if (!handled) {
      sendJson(response, 404, { ok: false, message: 'Not found.' })
    }
  } catch (error) {
    console.error(`API error for ${request.method} ${pathname}:`, error)
    sendJson(response, 500, { ok: false, message: 'Unable to complete the request.' })
  }
})

server.listen(port, host, () => {
  // Intentionally quiet. Docker and Nginx handle the outer logging.
})
