import http from 'node:http'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiMiddleware } from './api.mjs'
import { startScheduler } from './news.mjs'
import { needsAuth, hasValidAuth, checkPassword, makeSetCookie, loginPage } from './auth.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(here, '..', 'dist')
const PORT = Number(process.env.PORT) || 5274
/** 127.0.0.1 on a workstation; the cluster deployment sets HOST=0.0.0.0 behind its Service. */
const HOST = process.env.HOST || '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

/**
 * The news page has its own hostname (news.kcproto.com) pointed at this same server: on that
 * host the root is the paper, not the map. Everything else, including /api, is unchanged.
 */
const NEWS_HOSTS = (process.env.NEWS_HOSTS || 'news.').split(',').map((s) => s.trim()).filter(Boolean)
const isNewsHost = (host) => {
  const h = String(host || '').split(':')[0].toLowerCase()
  return NEWS_HOSTS.some((n) => (n.endsWith('.') ? h.startsWith(n) : h === n))
}

/** Resolve inside dist/ only — a request can never climb out with `..`. */
function resolveInDist(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
  const file = path.resolve(DIST, rel || 'index.html')
  return file === DIST || file.startsWith(DIST + path.sep) ? file : null
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')

  // Same-origin password gate for the public map host. News and localhost are never gated.
  if (needsAuth(req.headers.host)) {
    // The PWA shell assets — the web manifest and its icons — are fetched by the browser
    // WITHOUT credentials (a manifest link sends no cookie unless it's use-credentials), so
    // they must pass the gate or the browser gets the login HTML where it expects the icon
    // or the manifest JSON ("Manifest: Syntax error"). They carry no data, so this is safe.
    const publicAsset =
      url.pathname === '/manifest.webmanifest' ||
      /^\/(icon-(192|512|maskable-192|maskable-512)\.png|apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
    if (url.pathname === '/api/login' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => {
        body += c
        if (body.length > 4096) req.destroy()
      })
      req.on('end', () => {
        let pw = ''
        try {
          pw = JSON.parse(body || '{}').password
        } catch {
          /* bad body */
        }
        if (checkPassword(pw)) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': makeSetCookie(), 'Cache-Control': 'no-store' }).end('{"ok":true}')
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"ok":false}')
        }
      })
      return
    }
    if (!publicAsset && !hasValidAuth(req)) {
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"error":"auth required"}')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(loginPage())
      return
    }
  }

  if (url.pathname.startsWith('/api/')) {
    return apiMiddleware(req, res, null)
  }

  let file = resolveInDist(isNewsHost(req.headers.host) && url.pathname === '/' ? '/news/index.html' : url.pathname)
  if (!file) {
    res.writeHead(403).end('Forbidden')
    return
  }
  try {
    if ((await fsp.stat(file)).isDirectory()) file = path.join(file, 'index.html')
  } catch {
    file = path.join(DIST, 'index.html') // SPA fallback
  }

  try {
    const body = await fsp.readFile(file)
    const type = TYPES[path.extname(file)] || 'application/octet-stream'
    const cache = file.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache'
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': cache })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Bot Farm → http://${HOST}:${PORT}`)
  startScheduler()
})
