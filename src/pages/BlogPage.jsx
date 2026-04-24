import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { educationItems, educationThemes, officers } from '../content.js'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import {
  approveBlogPost,
  createBlogPost,
  deleteBlogPost,
  likeBlogPost,
  loadBlogPost,
  loadAdminBlogPosts,
  loadBlogPosts,
  loadLinkPreview,
  loadPriestAuthStatus,
} from '../lib/siteApi.js'
import { applySeoForPath } from '../lib/seo.js'

function formatRelativeTime(dateString) {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d`
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || ''
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || ''
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || ''
    }
  } catch {
    return ''
  }

  return ''
}

function getFacebookEmbedUrl(url) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('facebook.com')) return ''

    const encoded = encodeURIComponent(url)
    const isVideo = parsed.pathname.includes('/videos/') || parsed.pathname.includes('/reel/')
    const pluginPath = isVideo ? 'video.php' : 'post.php'
    return `https://www.facebook.com/plugins/${pluginPath}?href=${encoded}&show_text=true&width=500`
  } catch {
    return ''
  }
}

function extractImageUrlFromHtml(html = '') {
  try {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(String(html || ''), 'text/html')
    return doc.querySelector('img')?.getAttribute('src') || ''
  } catch {
    return ''
  }
}

function isDirectImageUrl(url = '') {
  try {
    const parsed = new URL(url)
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildPostShareUrl(postId) {
  const base = new URL(`/blog/${encodeURIComponent(postId)}`, window.location.origin)
  return base.toString()
}

function buildLinkPreviewInnerHtml(preview, url, isLoading = false) {
  const title = escapeHtml(preview?.title || url || 'Open link')
  const description = isLoading ? 'Loading preview...' : escapeHtml(preview?.description || '')
  const siteName = escapeHtml(preview?.siteName || '')
  const image = String(preview?.image || '').trim()
  const safeUrl = escapeHtml(preview?.url || url || '')

  return `
    <a href="${safeUrl}" target="_blank" rel="noreferrer noopener">
      ${image ? `<p><img src="${escapeHtml(image)}" alt="${title}" loading="lazy" /></p>` : ''}
      <p><strong>${title}</strong></p>
      ${description ? `<p>${description}</p>` : ''}
      ${siteName ? `<p>${siteName}</p>` : ''}
    </a>
  `.trim()
}

function isTypedPreviewUrl(value = '') {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim())
}

function detectMedia(url) {
  const trimmed = url.trim()
  const youtubeId = extractYouTubeId(trimmed)
  if (youtubeId) {
    return {
      type: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      label: 'YouTube video',
    }
  }

  const facebookEmbed = getFacebookEmbedUrl(trimmed)
  if (facebookEmbed) {
    return {
      type: 'facebook',
      src: facebookEmbed,
      label: 'Facebook embed',
    }
  }

  return null
}

function hasEmbeddedMedia(html = '') {
  return /<(img|iframe)\b/i.test(String(html || ''))
}

function normalizeSearchText(value = '') {
  return String(value || '').toLowerCase().trim()
}

function postMatchesQuery(post, query = '') {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const author = post.author || {}
  const haystack = [
    post.title,
    post.body,
    post.bodyHtml,
    author.name,
    author.title,
    post.approvalStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalizedQuery)
}

const BlockEmbed = Quill.import('blots/block/embed')

class LinkPreviewBlot extends BlockEmbed {
  static blotName = 'linkPreview'
  static tagName = 'blockquote'

  static create(value) {
    const node = super.create()
    const previewId = value?.previewId || `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const url = value?.url || ''
    const preview = value?.preview || null
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./i, '')
      } catch {
        return ''
      }
    })()

    node.dataset.previewId = previewId
    node.dataset.previewUrl = url
    node.dataset.previewResolved = preview ? '1' : '0'
    node.innerHTML = buildLinkPreviewInnerHtml(
      preview || {
        title: url || 'Open link',
        siteName: host,
      },
      url,
      !preview,
    )
    return node
  }

  static value(node) {
    return {
      previewId: node.dataset.previewId || '',
      url: node.dataset.previewUrl || '',
      previewResolved: node.dataset.previewResolved === '1',
    }
  }
}

Quill.register(LinkPreviewBlot, true)

function RichTextEditor({ onChange, onStatus, onPreviewLoadingChange }) {
  const toolbarRef = useRef(null)
  const editorRef = useRef(null)
  const quillRef = useRef(null)
  const isAutoFormattingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const onStatusRef = useRef(onStatus)
  const onPreviewLoadingChangeRef = useRef(onPreviewLoadingChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  useEffect(() => {
    onPreviewLoadingChangeRef.current = onPreviewLoadingChange
  }, [onPreviewLoadingChange])

  useEffect(() => {
    if (!editorRef.current || quillRef.current) return

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder: 'Write the post here.',
      modules: {
        toolbar: toolbarRef.current,
        history: {
          delay: 1000,
          maxStack: 500,
          userOnly: true,
        },
      },
    })

    quillRef.current = quill
    quill.root.innerHTML = ''

    const insertEmbedAtSelection = (type, value) => {
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 }
      quill.insertEmbed(range.index, type, value, 'user')
      quill.insertText(range.index + 1, '\n', 'user')
      quill.setSelection(range.index + 2, 0, 'silent')
    }

    const insertLinkPreviewEmbedAtSelection = (url, previewId) => {
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 }
      quill.insertEmbed(range.index, 'linkPreview', { url, previewId, preview: null }, 'user')
      quill.insertText(range.index + 1, '\n', 'user')
      quill.setSelection(range.index + 2, 0, 'silent')
    }

    const updateLinkPreviewNode = (previewId, preview, url) => {
      const node = quill.root.querySelector(`blockquote[data-preview-id="${previewId}"]`)
      if (!node) return false
      const blot = Quill.find(node)
      if (!blot) return false
      const index = quill.getIndex(blot)
      if (index < 0) return false

      isAutoFormattingRef.current = true
      quill.deleteText(index, 1, 'user')
      quill.insertEmbed(index, 'linkPreview', { url, previewId, preview }, 'user')
      quill.setSelection(quill.getLength(), 0, 'silent')
      isAutoFormattingRef.current = false
      return true
    }

    const runPreviewLoad = async (url, previewId, fallbackPreview) => {
      onPreviewLoadingChangeRef.current?.(1)
      try {
        const result = await loadLinkPreview(url)
        updateLinkPreviewNode(previewId, result?.preview || fallbackPreview, url)
      } catch {
        updateLinkPreviewNode(previewId, fallbackPreview, url)
      } finally {
        onPreviewLoadingChangeRef.current?.(-1)
      }
    }

    const getTypedUrlFromSelection = () => {
      const selection = quill.getSelection(true)
      if (!selection || selection.length > 0) return ''

      const textBeforeCursor = quill
        .getText(0, selection.index)
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
      const lines = textBeforeCursor.split('\n').map((item) => item.trim())
      const currentLineText = lines.at(-1) || ''
      if (isTypedPreviewUrl(currentLineText)) return currentLineText
      const previousLineText = lines.at(-2) || ''
      return isTypedPreviewUrl(previousLineText) ? previousLineText : ''
    }

    const handlePaste = async (event) => {
      const clipboard = event.clipboardData
      if (!clipboard) return

      const plainText = clipboard.getData('text/plain').trim()
      const html = clipboard.getData('text/html') || ''
      const directUrl = plainText.match(/^https?:\/\/\S+$/i)?.[0] || ''
      const imageUrl = extractImageUrlFromHtml(html) || (isDirectImageUrl(directUrl) ? directUrl : '')
      const media = directUrl ? detectMedia(directUrl) : null

      if (media || imageUrl || directUrl) {
        event.preventDefault()
        if (media) {
          insertEmbedAtSelection('video', media.src)
          return
        }
        if (imageUrl) {
          insertEmbedAtSelection('image', imageUrl)
          return
        }

        const previewId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        insertLinkPreviewEmbedAtSelection(directUrl, previewId)

        void runPreviewLoad(
          directUrl,
          previewId,
          { title: directUrl, siteName: new URL(directUrl).hostname },
        )
      }
    }

    const handleChange = (delta, oldDelta, source) => {
      const html = quill.root.innerHTML
      const text = quill.getText().replace(/\u00a0/g, ' ').trim()
      onChangeRef.current({
        html,
        text,
      })

      if (source !== 'user' || isAutoFormattingRef.current) return
      const typedInsert = Array.isArray(delta?.ops)
        ? delta.ops.some((op) => typeof op.insert === 'string' && /[ \n]/.test(op.insert))
        : false
      if (!typedInsert) return

      window.requestAnimationFrame(() => {
        const lineText = getTypedUrlFromSelection()
        if (!isTypedPreviewUrl(lineText)) return
        const selection = quill.getSelection(true)
        if (!selection) return
        const lineLength = lineText.length
        const deleteStart = Math.max(0, selection.index - lineLength - 1)

        const media = detectMedia(lineText)
        if (media) {
          isAutoFormattingRef.current = true
          quill.deleteText(deleteStart, lineLength + 1, 'user')
          insertEmbedAtSelection('video', media.src)
          isAutoFormattingRef.current = false
          return
        }

        if (isDirectImageUrl(lineText)) {
          isAutoFormattingRef.current = true
          quill.deleteText(deleteStart, lineLength + 1, 'user')
          insertEmbedAtSelection('image', lineText)
          isAutoFormattingRef.current = false
          return
        }

        const previewId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const fallbackPreview = { title: lineText, siteName: new URL(lineText).hostname }

        isAutoFormattingRef.current = true
        quill.deleteText(deleteStart, lineLength + 1, 'user')
        insertLinkPreviewEmbedAtSelection(lineText, previewId)
        isAutoFormattingRef.current = false

        void runPreviewLoad(lineText, previewId, fallbackPreview)
      })
    }

    quill.on('text-change', handleChange)
    quill.root.addEventListener('paste', handlePaste)
    handleChange()

    return () => {
      quill.off('text-change', handleChange)
      quill.root.removeEventListener('paste', handlePaste)
      quillRef.current = null
    }
  }, [])

  const quill = quillRef.current

  const applyLink = () => {
    if (!quill) return

    const selection = quill.getSelection()
    if (!selection) return

    const currentFormat = quill.getFormat(selection)
    const currentHref = typeof currentFormat.link === 'string' ? currentFormat.link : ''
    const url = window.prompt('Enter a link URL', currentHref)
    if (url === null) return

    const trimmed = url.trim()

    if (!trimmed) {
      quill.format('link', false)
      const text = quill.getText().replace(/\u00a0/g, ' ').trim()
      onChangeRef.current({
        html: quill.root.innerHTML,
        text,
      })
      return
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      onStatusRef.current?.('Use a link that starts with http:// or https://.')
      return
    }

    quill.format('link', trimmed)
  }

  return (
    <div className="blog-editor">
      <div className="blog-editor-header">
        <div>
          <div className="blog-editor-kicker">Rich text</div>
          <div className="blog-editor-caption">Style the post like a document, not a plain text box.</div>
        </div>
        <div ref={toolbarRef} className="blog-editor-toolbar ql-toolbar ql-snow" role="toolbar" aria-label="Text formatting">
          <span className="ql-formats">
            <button type="button" className="ql-bold" aria-label="Bold" />
            <button type="button" className="ql-italic" aria-label="Italic" />
            <button type="button" className="ql-underline" aria-label="Underline" />
          </span>
          <span className="ql-formats">
            <button type="button" className="ql-blockquote" aria-label="Quote" />
            <button type="button" className="ql-list" value="bullet" aria-label="Bulleted list" />
            <button type="button" className="ql-list" value="ordered" aria-label="Numbered list" />
          </span>
          <span className="ql-formats">
          <select className="ql-header" aria-label="Heading">
            <option value="">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>
            <button type="button" className="ql-link" aria-label="Link" />
          </span>
          <span className="ql-formats">
            <button type="button" className="ql-clean" aria-label="Clear formatting" />
          </span>
          <span className="blog-editor-custom-actions">
            <button
              type="button"
              className="blog-editor-btn"
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyLink}
            >
              Edit link
            </button>
          </span>
        </div>
      </div>
      <div className="blog-editor-surface">
        <div ref={editorRef} className="blog-editor-area" />
      </div>
    </div>
  )
}

function BlogPage() {
  const { postId = '' } = useParams()
  const [posts, setPosts] = useState([])
  const [composer, setComposer] = useState({
    title: '',
    bodyHtml: '',
    bodyText: '',
  })
  const [status, setStatus] = useState('')
  const [feedStatus, setFeedStatus] = useState('')
  const [isPriestAdmin, setIsPriestAdmin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [feedLoaded, setFeedLoaded] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [adminPosts, setAdminPosts] = useState([])
  const [adminPostsLoaded, setAdminPostsLoaded] = useState(false)
  const [deleteBusyId, setDeleteBusyId] = useState('')
  const [likeBusyId, setLikeBusyId] = useState('')
  const [copyBusyId, setCopyBusyId] = useState('')
  const [approvalBusyId, setApprovalBusyId] = useState('')
  const [editorKey, setEditorKey] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoadingCount, setPreviewLoadingCount] = useState(0)
  const [blogQuery, setBlogQuery] = useState('')
  const [blogFilter, setBlogFilter] = useState('all')

  useEffect(() => {
    let cancelled = false

    applySeoForPath(window.location.pathname, window.location.search)

    Promise.resolve()
      .then(async () => {
        const result = await loadBlogPosts()
        const loadedPosts = Array.isArray(result?.blogPosts) ? result.blogPosts : []

        if (!postId) {
          return loadedPosts
        }

        const matchedPost = loadedPosts.find((item) => item.id === postId)
        if (matchedPost) {
          return loadedPosts
        }

        try {
          const postResult = await loadBlogPost(postId)
          return postResult?.blogPost ? [postResult.blogPost, ...loadedPosts] : loadedPosts
        } catch {
          return loadedPosts
        }
      })
      .then((resultPosts) => {
        if (cancelled) return
        setPosts(Array.isArray(resultPosts) ? resultPosts : [])
        setFeedStatus('')
      })
      .catch((error) => {
        if (cancelled) return
        setFeedStatus(error.message || 'Unable to load posts.')
        setPosts([])
      })
      .finally(() => {
        if (cancelled) return
        setFeedLoaded(true)
      })

    loadPriestAuthStatus()
      .then((result) => {
        if (cancelled) return
        setIsPriestAdmin(Boolean(result?.authenticated))
        setAdminUser(result?.user || null)
      })
      .catch(() => {
        if (cancelled) return
        setIsPriestAdmin(false)
        setAdminUser(null)
      })
      .finally(() => {
        if (cancelled) return
        setAuthChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [postId])

  useEffect(() => {
    if (!authChecked) return

    if (!isPriestAdmin) {
      setAdminPosts([])
      setAdminPostsLoaded(true)
      return
    }

    let cancelled = false

    setAdminPostsLoaded(false)
    loadAdminBlogPosts()
      .then((result) => {
        if (cancelled) return
        setAdminPosts(Array.isArray(result?.blogPosts) ? result.blogPosts : [])
        setAdminPostsLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setAdminPosts([])
        setAdminPostsLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [authChecked, isPriestAdmin])

  useEffect(() => {
    if (!postId) return

    const timer = window.setTimeout(() => {
      document.getElementById(postId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)

    return () => window.clearTimeout(timer)
  }, [postId, posts.length])

  const currentAuthorPhoto = adminUser?.photoUrl || adminUser?.officer?.photo || ''
  const currentAuthorTitle = adminUser?.title || adminUser?.officer?.role || ''
  const isSuperAdmin = Boolean(adminUser?.isSuperAdmin)
  const pendingPosts = useMemo(() => {
    if (!isPriestAdmin) return []

    return adminPosts.filter((post) => {
      if (post.approvalStatus === 'approved') return false
      if (isSuperAdmin) return true
      return post.authorId === adminUser?.id
    })
  }, [adminPosts, adminUser?.id, isPriestAdmin, isSuperAdmin])
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (blogFilter === 'approved' && post.approvalStatus !== 'approved') return false
      if (blogFilter === 'pending' && post.approvalStatus === 'approved') return false
      if (blogFilter === 'media' && !hasEmbeddedMedia(post.bodyHtml)) return false
      return postMatchesQuery(post, blogQuery)
    })
  }, [blogFilter, blogQuery, posts])
  const filteredPendingPosts = useMemo(() => {
    return pendingPosts.filter((post) => postMatchesQuery(post, blogQuery))
  }, [blogQuery, pendingPosts])
  const canPublish =
    Boolean(adminUser?.id) &&
    Boolean(composer.title.trim()) &&
    Boolean(composer.bodyText.trim() || hasEmbeddedMedia(composer.bodyHtml)) &&
    previewLoadingCount === 0
  const activePost = postId
    ? posts.find((item) => item.id === postId) || adminPosts.find((item) => item.id === postId)
    : null

  const previewAuthor = {
    id: adminUser?.id || 'draft',
    name: adminUser?.name || 'Admin',
    title: currentAuthorTitle || 'Title not set',
    photoUrl: currentAuthorPhoto,
  }

  const handlePublish = async (event) => {
    event.preventDefault()
    if (!canPublish) return

    setStatus('')

    try {
      const result = await createBlogPost({
        title: composer.title.trim(),
        bodyHtml: composer.bodyHtml,
      })

      if (result?.blogPost) {
        if (result.blogPost.approvalStatus === 'approved') {
          setPosts((current) => [result.blogPost, ...current.filter((post) => post.id !== result.blogPost.id)])
        } else {
          setAdminPosts((current) => [result.blogPost, ...current.filter((post) => post.id !== result.blogPost.id)])
        }
      } else {
        const refreshed = await loadBlogPosts()
        setPosts(Array.isArray(refreshed?.blogPosts) ? refreshed.blogPosts : [])
        if (isPriestAdmin) {
          const refreshedAdmin = await loadAdminBlogPosts()
          setAdminPosts(Array.isArray(refreshedAdmin?.blogPosts) ? refreshedAdmin.blogPosts : [])
        }
      }

      setComposer({
        title: '',
        bodyHtml: '',
        bodyText: '',
      })
      setShowPreview(false)
      setEditorKey((current) => current + 1)
      setStatus(
        result?.blogPost?.approvalStatus === 'approved'
          ? 'Post published to the live feed.'
          : 'Post submitted for approval.',
      )
    } catch (error) {
      setStatus(error.message || 'Unable to publish post.')
    }
  }

  const handleDelete = async (post) => {
    if (!post?.id) return
    if (!window.confirm('Delete this post?')) return

    setDeleteBusyId(post.id)
    setStatus('')

    try {
      await deleteBlogPost(post.id)
      setPosts((current) => current.filter((item) => item.id !== post.id))
      setStatus('Post deleted.')
    } catch (error) {
      setStatus(error.message || 'Unable to delete post.')
    } finally {
      setDeleteBusyId('')
    }
  }

  const handleLike = async (post) => {
    if (!post?.id || likeBusyId === post.id) return

    setLikeBusyId(post.id)

    try {
      const result = await likeBlogPost(post.id)
      if (result?.blogPost) {
        setPosts((current) =>
          current.map((item) => (item.id === result.blogPost.id ? result.blogPost : item)),
        )
      } else {
        const refreshed = await loadBlogPosts()
        setPosts(Array.isArray(refreshed?.blogPosts) ? refreshed.blogPosts : [])
      }
    } catch (error) {
      setStatus(error.message || 'Unable to like post.')
    } finally {
      setLikeBusyId('')
    }
  }

  const handleCopyLink = async (post) => {
    if (!post?.id || copyBusyId === post.id) return

    const shareUrl = buildPostShareUrl(post.id)
    setCopyBusyId(post.id)

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        window.prompt('Copy this post link', shareUrl)
      }
    } catch {
      window.prompt('Copy this post link', shareUrl)
    } finally {
      window.setTimeout(() => {
        setCopyBusyId('')
      }, 1200)
    }
  }

  const handleApprovePost = async (post) => {
    if (!post?.id || approvalBusyId === post.id || !isSuperAdmin) return

    setApprovalBusyId(post.id)
    setStatus('')

    try {
      const result = await approveBlogPost({ postId: post.id })
      if (result?.blogPost) {
        setPosts((current) => [result.blogPost, ...current.filter((item) => item.id !== result.blogPost.id)])
        setAdminPosts((current) =>
          current.map((item) => (item.id === result.blogPost.id ? result.blogPost : item)),
        )
      }
      setStatus(result?.message || 'Post approved.')
    } catch (error) {
      setStatus(error.message || 'Unable to approve post.')
    } finally {
      setApprovalBusyId('')
    }
  }

  return (
    <main className="blog-page">
      <section className="blog-hero section-shell">
        <div className="container-xxl">
          <div className="blog-hero-grid">
            <div className="reveal">
              <p className="section-kicker text-white">Blog</p>
              <h1 className="blog-hero-title">Gourishankar Mandir Blog</h1>
              <p className="blog-hero-lede">
                News, study notes, and service updates from the temple team.
              </p>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <NavLink to="/about" className="btn btn-light rounded-pill px-4">
                  Meet the officers
                </NavLink>
                <NavLink to="/contact" className="btn btn-outline-light rounded-pill px-4">
                  Send a note
                </NavLink>
              </div>
            </div>

            <aside className="blog-hero-card surface surface-strong surface-pad reveal delay-1">
              <p className="section-kicker">Blog</p>
              <h2 className="h3 mb-3">Recent posts and service notes.</h2>
              <p className="section-intro mb-4">News, teachings, and service notes.</p>
              <div className="blog-mini-stats">
                <div>
                  <strong>{filteredPosts.length}</strong>
                  <span>posts</span>
                </div>
                <div>
                  <strong>4</strong>
                  <span>officers</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="section-block blog-tight-section">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad blog-study-block">
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
              <div>
                <p className="section-kicker">Teachings</p>
                <h2 className="section-title mb-0">Relevant study topics.</h2>
              </div>
              <p className="section-intro mb-0 blog-study-note">
                Core topics for scripture, meditation, and devotional practice.
              </p>
            </div>

            <div className="row g-3">
              {educationItems.map((item, index) => (
                <div className="col-md-4" key={item}>
                  <article className="blog-study-item reveal" style={{ animationDelay: `${index * 70}ms` }}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </article>
                </div>
              ))}
            </div>

            <div className="blog-study-themes mt-4">
              {educationThemes.map((theme) => (
                <span key={theme}>{theme}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block blog-tight-section">
        <div className="container-xxl">
          <div className="blog-layout">
            <div className="blog-main">
              <div className="surface surface-soft surface-pad mb-4">
                <div className="row g-3 align-items-end">
                  <div className="col-lg-7">
                    <p className="section-kicker mb-2">Search</p>
                    <h2 className="h4 mb-0">Filter blog posts.</h2>
                  </div>
                  <div className="col-lg-5">
                    <input
                      type="search"
                      className="form-control"
                      value={blogQuery}
                      onChange={(event) => setBlogQuery(event.target.value)}
                      placeholder="Search title, author, or body"
                    />
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'approved', label: 'Approved' },
                    { id: 'pending', label: 'Pending' },
                    { id: 'media', label: 'With media' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={blogFilter === item.id ? 'btn btn-primary btn-sm rounded-pill' : 'btn btn-outline-light btn-sm rounded-pill'}
                      onClick={() => setBlogFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {isPriestAdmin ? (
                <form className="surface surface-strong surface-pad blog-composer mb-4" onSubmit={handlePublish}>
                  <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                    <div>
                      <p className="section-kicker mb-2">Admin post</p>
                      <h2 className="section-title mb-0">Write as your admin profile.</h2>
                    </div>
                    <span className="blog-admin-badge">{authChecked ? 'Admin mode' : 'Checking access'}</span>
                  </div>

                  <div className="blog-composer-head">
                    <ProfileAvatar
                      key={`${adminUser?.id || 'admin'}-${currentAuthorPhoto || 'none'}`}
                      name={adminUser?.name || 'Admin'}
                      photoUrl={currentAuthorPhoto}
                    />
                    <div>
                      <strong>{adminUser?.name || 'Admin'}</strong>
                      <span>{currentAuthorTitle || 'Title not set'}</span>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Post title</label>
                      <input
                        className="form-control blog-input"
                        value={composer.title}
                        onChange={(event) =>
                          setComposer((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Morning teaching, festival note, or update"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Rich text body</label>
                      <RichTextEditor
                        key={editorKey}
                        onChange={({ html, text }) =>
                          setComposer((current) => ({
                            ...current,
                            bodyHtml: html,
                            bodyText: text,
                          }))
                        }
                        onStatus={setStatus}
                        onPreviewLoadingChange={(delta) =>
                          setPreviewLoadingCount((current) => Math.max(0, current + delta))
                        }
                      />
                    </div>
                  </div>

                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-4">
                    <p className="blog-composer-note mb-0">
                      Your profile photo and title will appear with each post. Paste links directly into the editor to
                      turn them into embeds or preview cards.
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-light rounded-pill px-4"
                        onClick={() => setShowPreview((current) => !current)}
                        disabled={
                          !composer.title.trim() &&
                          !composer.bodyText.trim() &&
                          !hasEmbeddedMedia(composer.bodyHtml)
                        }
                      >
                        {showPreview ? 'Hide preview' : 'Preview'}
                      </button>
                      <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={!canPublish}>
                        {previewLoadingCount > 0 ? 'Waiting for preview...' : 'Publish post'}
                      </button>
                    </div>
                  </div>

                  {status ? <p className="mt-3 mb-0 text-secondary">{status}</p> : null}
                  {previewLoadingCount > 0 ? (
                    <p className="mt-2 mb-0 text-secondary">Link previews are still loading.</p>
                  ) : null}
                </form>
              ) : null}

              {isPriestAdmin && showPreview ? (
                <article className="surface surface-strong surface-pad blog-post blog-draft-preview mb-4">
                  <div className="blog-post-header">
                    <div className="blog-author">
                      <ProfileAvatar
                        key={`${previewAuthor.id}-${previewAuthor.photoUrl || 'none'}`}
                        name={previewAuthor.name}
                        photoUrl={previewAuthor.photoUrl}
                      />
                      <div>
                        <strong>{previewAuthor.name}</strong>
                        <span>{previewAuthor.title}</span>
                      </div>
                    </div>
                    <div className="blog-post-meta">
                      <span>Preview</span>
                    </div>
                  </div>

                  <div className="blog-post-body">
                    <h2 className="blog-post-title">{composer.title || 'Post title'}</h2>
                    <div
                      className="blog-post-richtext"
                      dangerouslySetInnerHTML={{
                        __html:
                          composer.bodyHtml ||
                          (composer.bodyText ? `<p>${escapeHtml(composer.bodyText)}</p>` : '<p>Post body</p>'),
                      }}
                    />
                  </div>
                </article>
              ) : (
                null
              )}

              {isPriestAdmin && filteredPendingPosts.length ? (
                <div className="surface surface-strong surface-pad blog-approval-queue mb-4">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <p className="section-kicker mb-2">Blog moderation</p>
                      <h2 className="section-title mb-0">
                        {isSuperAdmin ? 'Pending approvals' : 'Your posts waiting for approval'}
                      </h2>
                    </div>
                    <span className="badge text-bg-light border text-dark">{filteredPendingPosts.length} pending</span>
                  </div>

                  <div className="d-grid gap-3">
                    {filteredPendingPosts.map((post) => {
                      const author = post.author || officers.find((item) => item.id === post.authorId) || officers[0]
                      const canApprovePost = isSuperAdmin && post.approvalStatus !== 'approved'

                      return (
                        <article className="blog-pending-item" key={post.id}>
                          <div className="blog-post-header">
                            <div className="blog-author">
                              <ProfileAvatar
                                key={`${post.id}-${author.id || author.name}-${author.photoUrl || author.photo || 'none'}`}
                                name={author.name}
                                photoUrl={author.photoUrl || author.photo || ''}
                              />
                              <div>
                                <strong>{author.name}</strong>
                                <span>{author.title || 'Title not set'}</span>
                              </div>
                            </div>
                            <div className="blog-post-meta">
                              <span>{formatRelativeTime(post.createdAt || post.publishedAt)}</span>
                              <span className="badge text-bg-warning text-dark">Pending approval</span>
                            </div>
                          </div>

                          <div className="blog-post-body">
                            <h3 className="blog-post-title">{post.title}</h3>
                            <div
                              className="blog-post-richtext"
                              dangerouslySetInnerHTML={{
                                __html: post.bodyHtml || `<p>${escapeHtml(post.body || '')}</p>`,
                              }}
                            />
                          </div>

                          <div className="blog-post-footer">
                            <div className="blog-post-reactions">
                              {canApprovePost ? (
                                <button
                                  type="button"
                                  className="blog-action blog-action-approve"
                                  onClick={() => handleApprovePost(post)}
                                  disabled={approvalBusyId === post.id}
                                >
                                  <span aria-hidden="true">✓</span>
                                  <strong>{approvalBusyId === post.id ? '...' : 'Approve'}</strong>
                                </button>
                              ) : null}
                            </div>
                            <div className="blog-share-actions" aria-label="Pending post actions">
                              <button
                                type="button"
                                className="blog-share-btn"
                                onClick={() => handleDelete(post)}
                                disabled={deleteBusyId === post.id}
                              >
                                <span>{deleteBusyId === post.id ? 'Deleting' : 'Delete'}</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <div className="blog-feed">
                {postId && feedLoaded && !feedStatus && (!isPriestAdmin || adminPostsLoaded) && !activePost ? (
                  <div className="surface surface-pad blog-composer-locked">
                    <p className="section-kicker">Blog</p>
                    <h2 className="section-title mb-3">Post unavailable.</h2>
                    <p className="section-intro mb-0">This shared link does not point to an approved post.</p>
                  </div>
                ) : null}

                {postId && activePost && !posts.some((item) => item.id === activePost.id) ? (
                  <article className="blog-post surface mb-4" id={activePost.id}>
                    <div className="blog-post-header">
                      <div className="blog-author">
                        <ProfileAvatar
                          key={`${activePost.id}-${activePost.author?.id || activePost.author?.name || 'author'}-${
                            activePost.author?.photoUrl || 'none'
                          }`}
                          name={activePost.author?.name || 'Author'}
                          photoUrl={activePost.author?.photoUrl || ''}
                        />
                        <div>
                          <strong>{activePost.author?.name || 'Author'}</strong>
                          <span>{activePost.author?.title || 'Title not set'}</span>
                        </div>
                      </div>
                      <div className="blog-post-meta">
                        <span>{formatRelativeTime(activePost.publishedAt || activePost.createdAt)}</span>
                        {activePost.approvalStatus !== 'approved' ? (
                          <span className="badge text-bg-warning text-dark">Pending approval</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="blog-post-body">
                      <h2 className="blog-post-title">{activePost.title}</h2>
                      <div
                        className="blog-post-richtext"
                        dangerouslySetInnerHTML={{
                          __html: activePost.bodyHtml || `<p>${escapeHtml(activePost.body || '')}</p>`,
                        }}
                      />
                    </div>

                  </article>
                ) : null}

                {!feedLoaded ? (
                  <div className="surface surface-pad blog-composer-locked">
                    <p className="section-kicker">Blog</p>
                    <h2 className="section-title mb-3">Loading posts.</h2>
                  </div>
                ) : null}

                {feedStatus ? (
                  <div className="surface surface-pad blog-composer-locked">
                    <p className="section-kicker">Blog</p>
                    <h2 className="section-title mb-3">Unable to load posts.</h2>
                    <p className="section-intro mb-0">{feedStatus}</p>
                  </div>
                ) : null}

                {feedLoaded && !feedStatus && filteredPosts.length === 0 ? (
                  <div className="surface surface-pad blog-composer-locked">
                    <p className="section-kicker">Blog</p>
                    <h2 className="section-title mb-3">No matching posts.</h2>
                    <p className="section-intro mb-0">
                      Try a different search or clear the filters.
                    </p>
                  </div>
                ) : null}

                {filteredPosts.map((post, index) => {
                  const author = post.author || officers.find((item) => item.id === post.authorId) || officers[0]
                  const canDeletePost = Boolean(
                    adminUser?.id && (post.authorId === adminUser.id || post.authorId === adminUser.officerId),
                  )

                  return (
                    <article
                      className="blog-post surface"
                      key={post.id}
                      id={post.id}
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="blog-post-header">
                        <div className="blog-author">
                          <ProfileAvatar
                            key={`${post.id}-${author.id || author.name}-${author.photoUrl || author.photo || 'none'}`}
                            name={author.name}
                            photoUrl={author.photoUrl || author.photo || ''}
                          />
                          <div>
                            <strong>{author.name}</strong>
                            <span>{author.title || 'Title not set'}</span>
                          </div>
                        </div>
                        <div className="blog-post-meta">
                          <span>{formatRelativeTime(post.publishedAt || post.createdAt)}</span>
                          {post.approvalStatus !== 'approved' ? (
                            <span className="badge text-bg-warning text-dark">Pending approval</span>
                          ) : null}
                          {isSuperAdmin && post.approvalStatus !== 'approved' ? (
                            <button
                              type="button"
                              className="blog-post-menu"
                              aria-label="Approve post"
                              onClick={() => handleApprovePost(post)}
                              disabled={approvalBusyId === post.id}
                            >
                              {approvalBusyId === post.id ? 'Approving...' : 'Approve'}
                            </button>
                          ) : null}
                          {canDeletePost ? (
                            <button
                              type="button"
                              className="blog-post-menu"
                              aria-label="Delete post"
                              onClick={() => handleDelete(post)}
                              disabled={deleteBusyId === post.id}
                            >
                              {deleteBusyId === post.id ? 'Deleting...' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="blog-post-body">
                        <h2 className="blog-post-title">{post.title}</h2>
                        <div
                          className="blog-post-richtext"
                          dangerouslySetInnerHTML={{
                            __html: post.bodyHtml || `<p>${escapeHtml(post.body || '')}</p>`,
                          }}
                        />
                      </div>

                      <div className="blog-post-footer">
                        <div className="blog-post-reactions">
                          <button
                            type="button"
                            className="blog-action blog-action-like"
                            onClick={() => handleLike(post)}
                            disabled={likeBusyId === post.id}
                          >
                            <span aria-hidden="true">♥</span>
                            <strong>{likeBusyId === post.id ? '...' : post.likes || 0}</strong>
                          </button>
                          <span className="blog-post-note">Temple update</span>
                        </div>
                        <div className="blog-share-actions" aria-label="Share post">
                          <button
                            type="button"
                            className="blog-share-btn"
                            onClick={() => handleCopyLink(post)}
                            disabled={copyBusyId === post.id}
                          >
                            <span>{copyBusyId === post.id ? 'Copied' : 'Copy link'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>

            <aside className="blog-sidebar">
              <div className="surface surface-pad blog-sidebar-card">
                <p className="section-kicker">Officers</p>
                <h2 className="h3 mb-3">Officer roster.</h2>
                <div className="blog-roster">
                  {officers.map((officer) => (
                    <article className="blog-roster-item" key={officer.id}>
                      <img src={officer.photo} alt={`Portrait for ${officer.name}`} />
                      <div>
                        <strong>{officer.name}</strong>
                        <span>{officer.role}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {isPriestAdmin ? (
                <div className="surface surface-strong surface-pad blog-sidebar-card">
                  <p className="section-kicker">Posting rules</p>
                  <h2 className="h3 mb-3">Keep it clear.</h2>
                  <ul className="blog-guidelines">
                    <li>Use the admin profile that matches the update.</li>
                    <li>Paste a YouTube or Facebook link to turn the post into an embed.</li>
                    <li>Keep text concise and direct.</li>
                  </ul>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}

export default BlogPage
