import http from 'node:http'
import process from 'node:process'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, resolve, normalize } from 'node:path'
import { createRequestObserver } from './site-api.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(__dirname, '..')
const DIST_DIR = resolve(APP_ROOT, 'dist')
const TEMPLATE_PATH = join(DIST_DIR, 'index.html')
const API_BASE_URL = (process.env.API_BASE_URL || 'http://api:8080').replace(/\/$/, '')
const SITE_URL = (process.env.SITE_URL || process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL || '').replace(/\/$/, '')

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Pragma', 'no-cache')
  response.end(JSON.stringify(payload))
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function getOrigin(request) {
  const forwardedHost = request.headers['x-forwarded-host'] || request.headers.host || ''
  const forwardedProto = request.headers['x-forwarded-proto']
  const proto = typeof forwardedProto === 'string' && forwardedProto.trim() ? forwardedProto.trim() : 'http'
  if (!forwardedHost) return SITE_URL || `${proto}://localhost`
  return `${proto}://${String(forwardedHost).trim().replace(/\/$/, '')}`
}

function safeDecodePathname(pathname) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function resolveWithinRoot(rootDir, pathname) {
  const decodedPath = safeDecodePathname(pathname).replace(/^\/+/, '')
  const normalized = normalize(decodedPath)
  const filePath = resolve(rootDir, normalized)
  if (!filePath.startsWith(rootDir)) return null
  return filePath
}

function getMimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}

async function readTemplate() {
  return readFile(TEMPLATE_PATH, 'utf8')
}

function replaceMetaTag(html, selector, replacement) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${selector})[^>]*>`, 'i')
  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`)
}

function replaceLinkTag(html, selector, replacement) {
  const pattern = new RegExp(`<link\\b(?=[^>]*\\b${selector})[^>]*>`, 'i')
  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }

  return html.replace('</head>', `  ${replacement}\n  </head>`)
}

function buildPageHtml(template, meta) {
  let html = template
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  html = replaceLinkTag(html, 'rel="canonical"', `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`)
  html = replaceMetaTag(
    html,
    'name="description"',
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
  )
  html = replaceMetaTag(html, 'name="robots"', `<meta name="robots" content="${escapeHtml(meta.robots)}" />`)
  html = replaceMetaTag(html, 'property="og:title"', `<meta property="og:title" content="${escapeHtml(meta.title)}" />`)
  html = replaceMetaTag(
    html,
    'property="og:description"',
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
  )
  html = replaceMetaTag(html, 'property="og:type"', `<meta property="og:type" content="${escapeHtml(meta.ogType)}" />`)
  html = replaceMetaTag(
    html,
    'property="og:site_name"',
    `<meta property="og:site_name" content="${escapeHtml(meta.siteName)}" />`,
  )
  html = replaceMetaTag(html, 'property="og:image"', `<meta property="og:image" content="${escapeHtml(meta.image)}" />`)
  html = replaceMetaTag(
    html,
    'property="og:image:secure_url"',
    `<meta property="og:image:secure_url" content="${escapeHtml(meta.image)}" />`,
  )
  html = replaceMetaTag(
    html,
    'property="og:image:alt"',
    `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`,
  )
  html = replaceMetaTag(html, 'property="og:url"', `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`)
  html = replaceMetaTag(html, 'name="twitter:card"', `<meta name="twitter:card" content="${escapeHtml(meta.twitterCard)}" />`)
  html = replaceMetaTag(
    html,
    'name="twitter:image"',
    `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`,
  )
  html = replaceMetaTag(
    html,
    'name="twitter:image:alt"',
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`,
  )
  html = replaceMetaTag(html, 'name="twitter:title"', `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`)
  html = replaceMetaTag(
    html,
    'name="twitter:description"',
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
  )

  if (meta.articlePublishedTime) {
    const articleMeta = [
      `<meta property="article:published_time" content="${escapeHtml(meta.articlePublishedTime)}" />`,
      meta.articleModifiedTime
        ? `<meta property="article:modified_time" content="${escapeHtml(meta.articleModifiedTime)}" />`
        : '',
      meta.articleAuthor ? `<meta property="article:author" content="${escapeHtml(meta.articleAuthor)}" />` : '',
    ]
      .filter(Boolean)
      .join('\n  ')

    if (/property="article:published_time"/i.test(html)) {
      html = html.replace(/<meta\b(?=[^>]*\bproperty="article:published_time")[^>]*>/i, articleMeta.split('\n  ')[0])
      if (meta.articleModifiedTime) {
        html = html.replace(
          /<meta\b(?=[^>]*\bproperty="article:modified_time")[^>]*>/i,
          articleMeta.split('\n  ')[1],
        )
      }
      if (meta.articleAuthor) {
        html = html.replace(
          /<meta\b(?=[^>]*\bproperty="article:author")[^>]*>/i,
          meta.articleAuthor ? articleMeta.split('\n  ').at(-1) : '',
        )
      }
    } else {
      html = html.replace('</head>', `  ${articleMeta}\n  </head>`)
    }
  }

  return html
}

async function loadBlogPost(postId) {
  const response = await fetch(`${API_BASE_URL}/api/blog-posts?postId=${encodeURIComponent(postId)}`)
  if (!response.ok) return null
  const data = await response.json()
  return data?.blogPost || null
}

async function buildMetaForPath(request, pathname) {
  const origin = getOrigin(request)
  const siteName = 'Gourishankar Mandir'
  const defaultImage = new URL('/images/og-temple.jpg', origin).toString()

  if (pathname === '/blog' || pathname === '/blog/') {
    return {
      title: `Blog | ${siteName}`,
      description: 'Temple updates, posts, and service notes from the priest team.',
      canonical: new URL('/blog', origin).toString(),
      robots: 'index, follow',
      ogType: 'website',
      siteName,
      image: defaultImage,
      imageAlt: 'Gourishankar Mandir temple view',
      twitterCard: 'summary_large_image',
    }
  }

  if (pathname.startsWith('/blog/') && pathname !== '/blog/') {
    const postId = pathname.split('/').filter(Boolean)[1] || ''
    const post = postId ? await loadBlogPost(postId) : null
    if (!post) {
      return {
        title: `Post not found | ${siteName}`,
        description: 'Temple update unavailable.',
        canonical: new URL(pathname, origin).toString(),
        robots: 'noindex, nofollow',
        ogType: 'article',
        siteName,
        image: defaultImage,
        imageAlt: 'Gourishankar Mandir temple view',
        twitterCard: 'summary_large_image',
      }
    }

    const description = stripHtml(post.bodyHtml || post.body || '')
    const image = post.author?.photoUrl ? new URL(post.author.photoUrl, origin).toString() : defaultImage
    return {
      title: `${post.title || 'Blog Post'} | ${siteName}`,
      description,
      canonical: new URL(`/blog/${post.id}`, origin).toString(),
      robots: 'index, follow',
      ogType: 'article',
      siteName,
      image,
      imageAlt: post.author?.name ? `Post by ${post.author.name}` : 'Gourishankar Mandir temple view',
      twitterCard: 'summary_large_image',
      articlePublishedTime: post.publishedAt || post.createdAt || '',
      articleModifiedTime: post.updatedAt || post.createdAt || '',
      articleAuthor: post.author?.name || '',
    }
  }

  return {
    title: `Gourishankar Mandir | Virtual Darshan, Prayer, Learning, and Satsang`,
    description:
      'Gourishankar Mandir offers virtual darshan, sacred services, learning, community, and devotional support.',
    canonical: new URL(pathname || '/', origin).toString(),
    robots: 'index, follow',
    ogType: 'website',
    siteName,
    image: defaultImage,
    imageAlt: 'Gourishankar Mandir temple view',
    twitterCard: 'summary_large_image',
  }
}

async function serveStaticFile(response, filePath) {
  const data = await readFile(filePath)
  response.statusCode = 200
  response.setHeader('Content-Type', getMimeType(filePath))
  response.setHeader('Cache-Control', filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  response.end(data)
}

async function proxyApi(request, response, requestId) {
  const targetUrl = `${API_BASE_URL}${request.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (value == null) continue
    if (key === 'host' || key === 'connection' || key === 'content-length') continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  }
  headers.set('x-request-id', requestId)

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method || '') ? undefined : request,
    duplex: 'half',
  })

  response.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-encoding') return
    if (key.toLowerCase() === 'transfer-encoding') return
    response.setHeader(key, value)
  })

  const buffer = Buffer.from(await upstream.arrayBuffer())
  response.end(buffer)
}

async function handleRequest(request, response) {
  const parsedUrl = new URL(request.url, 'http://localhost')
  const pathname = parsedUrl.pathname
  const observer = createRequestObserver({ request, response, service: 'web', route: pathname })
  const { requestId } = observer

  if (pathname === '/healthz') {
    const templateReady = await fileExists(TEMPLATE_PATH)
    sendJson(response, 200, {
      ok: true,
      service: 'web',
      status: 'ok',
      requestId,
      uptimeMs: Date.now() - observer.startedAt,
      templateReady,
    })
    return
  }

  if (pathname === '/readyz') {
    const templateReady = await fileExists(TEMPLATE_PATH)
    let apiReady = false
    let apiStatus = 0

    try {
      const upstream = await fetchWithTimeout(`${API_BASE_URL}/api/readyz`, {
        headers: { 'x-request-id': requestId },
      })
      apiStatus = upstream.status
      apiReady = upstream.ok
    } catch {
      apiReady = false
      apiStatus = 0
    }

    const ready = templateReady && apiReady
    sendJson(response, ready ? 200 : 503, {
      ok: ready,
      service: 'web',
      status: ready ? 'ready' : 'not_ready',
      requestId,
      uptimeMs: Date.now() - observer.startedAt,
      templateReady,
      apiReady,
      apiStatus,
      ready,
    })
    return
  }

  if (pathname.startsWith('/api/')) {
    await proxyApi(request, response, requestId)
    return
  }

  if (pathname.startsWith('/uploads/')) {
    const uploadPath = resolveWithinRoot(APP_ROOT, pathname)
    if (uploadPath && await fileExists(uploadPath)) {
      await serveStaticFile(response, uploadPath)
      return
    }
  }

  const staticFilePath = resolveWithinRoot(DIST_DIR, pathname)
  if (staticFilePath && pathname !== '/' && await fileExists(staticFilePath)) {
    await serveStaticFile(response, staticFilePath)
    return
  }

  const template = await readTemplate()
  const meta = await buildMetaForPath(request, pathname)
  const html = buildPageHtml(template, meta)
  response.statusCode = 200
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.setHeader('Cache-Control', 'no-cache')
  response.end(html)
}

const port = Number(process.env.PORT || 80)
const host = process.env.HOST || '0.0.0.0'

http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(`Web error for ${request.method} ${request.url}:`, error)
    response.statusCode = 500
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.end('Unable to load page.')
  })
}).listen(port, host)
