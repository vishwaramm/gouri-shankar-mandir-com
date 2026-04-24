import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { CommunityEventsPanel } from '../components/CommunityEventsPanel.jsx'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import {
  createCommunityEvent,
  deleteCommunityEvent,
  loadPriestAuthStatus,
  loadApiMetrics,
  loadSiteData,
  deleteContactMessage,
  markContactMessageRead,
  resolveOperationalAlert,
  replyContactMessage,
  markServiceRequestCompleted,
  processServiceCancellation,
  processServiceRefund,
  syncSquareOrders,
  updateAdminUserProfile,
} from '../lib/siteApi.js'
import {
  AdminAccessRequestsPanel,
  AdminAuditLogPanel,
  ApiMetricsPanel,
  CommunityRsvpsPanel,
  ContactMessagesPanel,
  ClientErrorLogPanel,
  OrderEventLogPanel,
  SiteAnalyticsPanel,
  TempleLettersPanel,
  SquareSyncPanel,
  ServiceRequestCard,
  SupportRequestCard,
} from '../components/PriestToolsSections.jsx'

function PriestToolsPage() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
  })
  const [adminUser, setAdminUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [syncStatus, setSyncStatus] = useState({
    webhookConfigured: false,
    signatureConfigured: false,
    webhookUrl: '',
    recentEvents: 0,
    lastEventAt: '',
    lastEventType: '',
  })
  const [recentEvents, setRecentEvents] = useState([])
  const [adminAccessRequests, setAdminAccessRequests] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [newsletters, setNewsletters] = useState([])
  const [rsvps, setRsvps] = useState([])
  const [communityEvents, setCommunityEvents] = useState([])
  const [blogPosts, setBlogPosts] = useState([])
  const [contactMessages, setContactMessages] = useState([])
  const [adminAuditEvents, setAdminAuditEvents] = useState([])
  const [clientErrorEvents, setClientErrorEvents] = useState([])
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState(null)
  const [apiMetrics, setApiMetrics] = useState(null)
  const [metricsBusy, setMetricsBusy] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [resolvingAlertById, setResolvingAlertById] = useState({})
  const [adminPermissions, setAdminPermissions] = useState({
    role: 'staff',
    isSuperAdmin: false,
    canAssignAdminTitles: false,
    canViewAdminAccessRequests: false,
    canViewSquareSync: false,
    canResetSiteData: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [completionStatusById, setCompletionStatusById] = useState({})
  const [completionBusyById, setCompletionBusyById] = useState({})
  const [cancellationStatusById, setCancellationStatusById] = useState({})
  const [cancellationBusyById, setCancellationBusyById] = useState({})
  const [refundStatusById, setRefundStatusById] = useState({})
  const [refundBusyById, setRefundBusyById] = useState({})
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [orderSyncBusyById, setOrderSyncBusyById] = useState({})
  const [orderSyncStatusById, setOrderSyncStatusById] = useState({})
  const [adminProfileDrafts, setAdminProfileDrafts] = useState({})
  const [adminProfileBusyById, setAdminProfileBusyById] = useState({})
  const [adminProfileStatusById, setAdminProfileStatusById] = useState({})
  const [contactReplyDrafts, setContactReplyDrafts] = useState({})
  const [contactReplyBusyById, setContactReplyBusyById] = useState({})
  const [contactReplyStatusById, setContactReplyStatusById] = useState({})
  const [contactDeleteBusyById, setContactDeleteBusyById] = useState({})
  const [contactDeleteStatusById, setContactDeleteStatusById] = useState({})
  const [contactReadBusyById, setContactReadBusyById] = useState({})
  const [contactReadStatusById, setContactReadStatusById] = useState({})
  const [communityEventBusyById, setCommunityEventBusyById] = useState({})
  const [communityEventStatusById, setCommunityEventStatusById] = useState({})

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }, [requests])
  const supportRequests = useMemo(() => {
    return sortedRequests.filter((item) => ['cancel_requested', 'refund_requested'].includes(item.serviceStatus))
  }, [sortedRequests])
  const sentCount = sortedRequests.filter((item) => item.paymentPageSentAt).length
  const refundCount = sortedRequests.filter((item) => item.refundedAt).length
  const supportCount = supportRequests.length
  const newsletterCount = newsletters.length
  const communityEventCount = communityEvents.length
  const rsvpCount = rsvps.length
  const [activeTab, setActiveTab] = useState('overview')

  const getSupportLabel = (request) => {
    if (request.serviceStatus === 'refund_requested') return 'Refund requested'
    if (request.serviceStatus === 'cancel_requested') return 'Cancellation requested'
    return 'Support requested'
  }

  const refreshAuth = useCallback(async () => {
    const status = await loadPriestAuthStatus()
    setAuth({
      loading: false,
      authenticated: Boolean(status.authenticated),
    })
    setAdminUser(status.user || null)
    return status
  }, [])

  const refreshRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await loadSiteData()
      setRequests(Array.isArray(data.orders) ? data.orders : [])
      setRecentEvents(Array.isArray(data.orderEvents) ? data.orderEvents : [])
      setNewsletters(Array.isArray(data.newsletters) ? data.newsletters : [])
      setRsvps(Array.isArray(data.rsvps) ? data.rsvps : [])
      setCommunityEvents(Array.isArray(data.communityEvents) ? data.communityEvents : [])
      setBlogPosts(Array.isArray(data.blogPosts) ? data.blogPosts : [])
      setContactMessages(Array.isArray(data.contactMessages) ? data.contactMessages : [])
      setAdminAuditEvents(Array.isArray(data.adminAuditEvents) ? data.adminAuditEvents : [])
      setClientErrorEvents(Array.isArray(data.clientErrorEvents) ? data.clientErrorEvents : [])
      setAnalyticsSnapshot(data.analytics || null)
      setAdminAccessRequests(Array.isArray(data.adminAccessRequests) ? data.adminAccessRequests : [])
      setAdminUsers(Array.isArray(data.adminUsers) ? data.adminUsers : [])
      setAdminPermissions(
        data.adminPermissions || {
          role: 'staff',
          isSuperAdmin: false,
          canAssignAdminTitles: false,
          canViewAdminAccessRequests: false,
          canViewSquareSync: false,
          canResetSiteData: false,
        },
      )
      setSyncStatus(
        data.squareSyncStatus || {
          webhookConfigured: false,
          signatureConfigured: false,
          webhookUrl: '',
          recentEvents: 0,
          lastEventAt: '',
          lastEventType: '',
        },
      )
    } catch (fetchError) {
      const message = fetchError?.message || 'Unable to load service requests.'
      setError(message)
      if (/unauthorized|not configured/i.test(message)) {
        setAuth((current) => ({ ...current, authenticated: false }))
        navigate('/priest-review', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const refreshMetrics = useCallback(async () => {
    setMetricsBusy(true)
    setMetricsError('')

    try {
      const data = await loadApiMetrics()
      setApiMetrics(data || null)
    } catch (fetchError) {
      setMetricsError(fetchError?.message || 'Unable to load metrics.')
      setApiMetrics(null)
    } finally {
      setMetricsBusy(false)
    }
  }, [])

  useEffect(() => {
    refreshAuth()
      .then((status) => {
        if (status.authenticated) {
          refreshRequests()
          refreshMetrics()
        } else {
          navigate('/priest-review', { replace: true })
        }
      })
      .catch(() => {
        setAuth({ loading: false, authenticated: false })
        navigate('/priest-review', { replace: true })
      })
  }, [navigate, refreshAuth, refreshMetrics, refreshRequests])

  useEffect(() => {
    if (!auth.authenticated) return undefined

    const timer = window.setInterval(() => {
      void refreshMetrics()
    }, 60_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [auth.authenticated, refreshMetrics])

  const handleResolveAlert = useCallback(
    async (alert) => {
      if (!alert?.id) return

      setResolvingAlertById((current) => ({ ...current, [alert.id]: true }))
      try {
        await resolveOperationalAlert({ alertId: alert.id })
        await refreshMetrics()
      } catch (resolveError) {
        setMetricsError(resolveError?.message || 'Unable to resolve alert.')
      } finally {
        setResolvingAlertById((current) => ({ ...current, [alert.id]: false }))
      }
    },
    [refreshMetrics],
  )

  useEffect(() => {
    setAdminProfileDrafts((current) => {
      const next = { ...current }
      adminUsers.forEach((item) => {
        const existing = next[item.id] || {}
        next[item.id] = {
          title: existing.title ?? item.title ?? '',
        }
      })
      return next
    })
  }, [adminUsers])

  const handleMarkComplete = async (request) => {
    if (!request.id) return

    setCompletionBusyById((current) => ({ ...current, [request.id]: true }))
    setCompletionStatusById((current) => ({ ...current, [request.id]: 'Marking complete...' }))

    try {
      const result = await markServiceRequestCompleted({
        requestId: request.id,
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                serviceStatus: result.entry?.serviceStatus || 'completed',
                serviceCompletedAt: result.entry?.serviceCompletedAt || '',
                serviceCompletionNotifiedAt: result.entry?.serviceCompletionNotifiedAt || '',
                completionNote: result.entry?.completionNote || '',
              }
            : item,
        ),
      )
      setCompletionStatusById((current) => ({
        ...current,
        [request.id]: result.completionEmailSent
          ? 'Service marked complete. Completion email sent.'
          : 'Service marked complete. Completion email was not sent automatically.',
      }))
    } catch (completeError) {
      setCompletionStatusById((current) => ({
        ...current,
        [request.id]: completeError?.message || 'Unable to mark complete.',
      }))
    } finally {
      setCompletionBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleProcessRefund = async (request) => {
    if (!request.id) return

    setRefundBusyById((current) => ({ ...current, [request.id]: true }))
    setRefundStatusById((current) => ({ ...current, [request.id]: 'Processing refund...' }))

    try {
      const result = await processServiceRefund({
        requestId: request.id,
        reason: request.supportRequestReason || request.completionNote || 'Service refund',
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                serviceStatus: result.entry?.serviceStatus || 'refunded',
                refundRequestedAt: result.entry?.refundRequestedAt || item.refundRequestedAt || '',
                refundedAt: result.entry?.refundedAt || '',
                refundStatus: result.entry?.refundStatus || '',
                refundSquareRefundId: result.entry?.refundSquareRefundId || '',
              }
            : item,
        ),
      )
      setRefundStatusById((current) => ({
        ...current,
        [request.id]: result.refundEmailSent
          ? 'Refund processed. Refund email sent.'
          : 'Refund processed. Refund email was not sent automatically.',
      }))
      setCompletionStatusById((current) => ({
        ...current,
        [request.id]: '',
      }))
    } catch (refundError) {
      setRefundStatusById((current) => ({
        ...current,
        [request.id]: refundError?.message || 'Unable to process refund.',
      }))
    } finally {
      setRefundBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleProcessCancellation = async (request) => {
    if (!request.id) return

    setCancellationBusyById((current) => ({ ...current, [request.id]: true }))
    setCancellationStatusById((current) => ({ ...current, [request.id]: 'Resolving cancellation...' }))

    try {
      const result = await processServiceCancellation({
        requestId: request.id,
        reason: request.supportRequestReason || request.completionNote || 'Service cancellation',
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                serviceStatus: result.entry?.serviceStatus || 'cancelled',
                cancelledAt: result.entry?.cancelledAt || '',
                supportRequestType: result.entry?.supportRequestType || 'cancel',
                supportRequestedAt: result.entry?.supportRequestedAt || item.supportRequestedAt || '',
                supportRequestReason: result.entry?.supportRequestReason || item.supportRequestReason || '',
              }
            : item,
        ),
      )
      setCancellationStatusById((current) => ({
        ...current,
        [request.id]: result.cancellationEmailSent
          ? 'Cancellation resolved. Email sent.'
          : 'Cancellation resolved. Email was not sent automatically.',
      }))
      setRefundStatusById((current) => ({
        ...current,
        [request.id]: '',
      }))
    } catch (cancellationError) {
      setCancellationStatusById((current) => ({
        ...current,
        [request.id]: cancellationError?.message || 'Unable to resolve cancellation.',
      }))
    } finally {
      setCancellationBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleSyncSquare = async () => {
    setSyncBusy(true)
    setSyncMessage('Syncing Square records...')

    try {
      const result = await syncSquareOrders()
      setSyncMessage(result.message || 'Square sync complete.')

      const data = await loadSiteData()
      setRequests(Array.isArray(data.orders) ? data.orders : [])
      setRecentEvents(Array.isArray(data.orderEvents) ? data.orderEvents : [])
      setNewsletters(Array.isArray(data.newsletters) ? data.newsletters : [])
      setRsvps(Array.isArray(data.rsvps) ? data.rsvps : [])
      setCommunityEvents(Array.isArray(data.communityEvents) ? data.communityEvents : [])
      setBlogPosts(Array.isArray(data.blogPosts) ? data.blogPosts : [])
      setContactMessages(Array.isArray(data.contactMessages) ? data.contactMessages : [])
      setAdminAccessRequests(Array.isArray(data.adminAccessRequests) ? data.adminAccessRequests : [])
      setAdminUsers(Array.isArray(data.adminUsers) ? data.adminUsers : [])
      setAdminPermissions(
        data.adminPermissions || {
          role: 'staff',
          isSuperAdmin: false,
          canAssignAdminTitles: false,
          canViewAdminAccessRequests: false,
          canViewSquareSync: false,
          canResetSiteData: false,
        },
      )
      setSyncStatus(
        data.squareSyncStatus || {
          webhookConfigured: false,
          signatureConfigured: false,
          webhookUrl: '',
          recentEvents: 0,
          lastEventAt: '',
          lastEventType: '',
        },
      )
    } catch (syncError) {
      setSyncMessage(syncError?.message || 'Unable to sync Square records.')
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSyncOrder = async (request) => {
    if (!request?.id) return

    setOrderSyncBusyById((current) => ({ ...current, [request.id]: true }))
    setOrderSyncStatusById((current) => ({ ...current, [request.id]: 'Syncing this order...' }))

    try {
      const result = await syncSquareOrders({
        requestId: request.id,
        orderCode: request.orderCode || '',
      })

      setOrderSyncStatusById((current) => ({
        ...current,
        [request.id]: result.message || 'Order synced.',
      }))

      const data = await loadSiteData()
      setRequests(Array.isArray(data.orders) ? data.orders : [])
      setRecentEvents(Array.isArray(data.orderEvents) ? data.orderEvents : [])
      setNewsletters(Array.isArray(data.newsletters) ? data.newsletters : [])
      setRsvps(Array.isArray(data.rsvps) ? data.rsvps : [])
      setCommunityEvents(Array.isArray(data.communityEvents) ? data.communityEvents : [])
      setBlogPosts(Array.isArray(data.blogPosts) ? data.blogPosts : [])
      setContactMessages(Array.isArray(data.contactMessages) ? data.contactMessages : [])
      setAdminAccessRequests(Array.isArray(data.adminAccessRequests) ? data.adminAccessRequests : [])
      setAdminUsers(Array.isArray(data.adminUsers) ? data.adminUsers : [])
      setAdminPermissions(
        data.adminPermissions || {
          role: 'staff',
          isSuperAdmin: false,
          canAssignAdminTitles: false,
          canViewAdminAccessRequests: false,
          canViewSquareSync: false,
          canResetSiteData: false,
        },
      )
      setSyncStatus(
        data.squareSyncStatus || {
          webhookConfigured: false,
          signatureConfigured: false,
          webhookUrl: '',
          recentEvents: 0,
          lastEventAt: '',
          lastEventType: '',
        },
      )
    } catch (syncError) {
      setOrderSyncStatusById((current) => ({
        ...current,
        [request.id]: syncError?.message || 'Unable to sync this order.',
      }))
    } finally {
      setOrderSyncBusyById((current) => ({ ...current, [request.id]: false }))
    }
  }

  const handleSaveAdminProfile = async (adminProfile) => {
    if (!adminProfile?.id) return

    setAdminProfileBusyById((current) => ({ ...current, [adminProfile.id]: true }))
    setAdminProfileStatusById((current) => ({ ...current, [adminProfile.id]: '' }))

    const draft = adminProfileDrafts[adminProfile.id] || {}

    try {
      const result = await updateAdminUserProfile({
        adminUserId: adminProfile.id,
        title: draft.title || '',
      })

      setAdminProfileStatusById((current) => ({
        ...current,
        [adminProfile.id]: result.message || 'Admin profile updated.',
      }))

      if (result.user?.id) {
        setAdminProfileDrafts((current) => ({
          ...current,
          [result.user.id]: {
            title: result.user.title || '',
          },
        }))
      }

      setAdminUsers((current) =>
        current.map((item) => (item.id === adminProfile.id ? result.user || item : item)),
      )
      if (adminUser?.id === adminProfile.id) {
        setAdminUser(result.user || null)
      }
      await refreshAuth()
      await refreshRequests()
    } catch (profileError) {
      setAdminProfileStatusById((current) => ({
        ...current,
        [adminProfile.id]: profileError?.message || 'Unable to update admin profile.',
      }))
    } finally {
      setAdminProfileBusyById((current) => ({ ...current, [adminProfile.id]: false }))
    }
  }

  const isSuperAdmin = Boolean(adminPermissions.canAssignAdminTitles)
  const currentOfficerId = adminUser?.officerId || ''
  const visibleContactMessages = useMemo(() => {
    if (!contactMessages.length) return []
    return [...contactMessages]
      .filter((message) => {
        const hiddenIds = Array.isArray(message.hiddenForOfficerIds) ? message.hiddenForOfficerIds : []
        if (currentOfficerId && hiddenIds.includes(currentOfficerId)) return false
        if (isSuperAdmin) return true
        const recipientIds = Array.isArray(message.recipientOfficerIds) ? message.recipientOfficerIds : []
        return currentOfficerId ? recipientIds.includes(currentOfficerId) : false
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }, [contactMessages, currentOfficerId, isSuperAdmin])
  const contactCount = visibleContactMessages.length
  const dashboardTabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview' },
      { id: 'titles', label: 'Admin titles', count: isSuperAdmin ? adminUsers.length : 0 },
      { id: 'inbox', label: 'Inbox', count: contactCount + newsletterCount },
      { id: 'community', label: 'Community', count: communityEventCount + rsvpCount },
      { id: 'support', label: 'Support', count: supportCount + sortedRequests.length },
      { id: 'analytics', label: 'Analytics' },
      { id: 'diagnostics', label: 'Diagnostics' },
    ],
    [isSuperAdmin, adminUsers.length, contactCount, newsletterCount, communityEventCount, rsvpCount, supportCount, sortedRequests.length],
  )

  const handleContactReplyDraftChange = (messageId, value) => {
    setContactReplyDrafts((current) => ({
      ...current,
      [messageId]: value,
    }))
  }

  const handleReplyContactMessage = async (message) => {
    if (!message?.id) return
    const replyMessage = (contactReplyDrafts[message.id] || '').trim()
    if (!replyMessage) {
      setContactReplyStatusById((current) => ({
        ...current,
        [message.id]: 'Write a reply first.',
      }))
      return
    }

    setContactReplyBusyById((current) => ({ ...current, [message.id]: true }))
    setContactReplyStatusById((current) => ({ ...current, [message.id]: 'Sending reply...' }))

    try {
      const result = await replyContactMessage({
        messageId: message.id,
        replyMessage,
      })

      const updatedEntry = result.entry || null
      if (updatedEntry) {
        setContactMessages((current) =>
          current.map((item) => (item.id === updatedEntry.id ? updatedEntry : item)),
        )
      }

      setContactReplyDrafts((current) => ({
        ...current,
        [message.id]: '',
      }))
      setContactReplyStatusById((current) => ({
        ...current,
        [message.id]: result.emailed
          ? 'Reply sent.'
          : result.mailStatus === 'missing_smtp'
            ? 'Reply saved, but email delivery is not configured.'
            : result.mailError
              ? `Reply saved, but email delivery failed: ${result.mailError}`
              : 'Reply saved, but email delivery failed.',
      }))
    } catch (replyError) {
      setContactReplyStatusById((current) => ({
        ...current,
        [message.id]: replyError?.message || 'Unable to send reply.',
      }))
    } finally {
      setContactReplyBusyById((current) => ({ ...current, [message.id]: false }))
    }
  }

  const handleDeleteContactMessage = async (message) => {
    if (!message?.id) return

    setContactDeleteBusyById((current) => ({ ...current, [message.id]: true }))
    setContactDeleteStatusById((current) => ({ ...current, [message.id]: 'Removing from your inbox...' }))

    try {
      const result = await deleteContactMessage({
        messageId: message.id,
      })

      const updatedEntry = result.entry || null
      if (updatedEntry) {
        setContactMessages((current) =>
          current.map((item) => (item.id === updatedEntry.id ? updatedEntry : item)),
        )
      }

      setContactDeleteStatusById((current) => ({
        ...current,
        [message.id]: result.message || 'Removed from your inbox.',
      }))
    } catch (deleteError) {
      setContactDeleteStatusById((current) => ({
        ...current,
        [message.id]: deleteError?.message || 'Unable to remove message.',
      }))
    } finally {
      setContactDeleteBusyById((current) => ({ ...current, [message.id]: false }))
    }
  }

  const handleMarkContactMessageRead = async (message) => {
    if (!message?.id) return

    setContactReadBusyById((current) => ({ ...current, [message.id]: true }))
    setContactReadStatusById((current) => ({ ...current, [message.id]: 'Marking as read...' }))

    try {
      const result = await markContactMessageRead({
        messageId: message.id,
      })

      const updatedEntry = result.entry || null
      if (updatedEntry) {
        setContactMessages((current) =>
          current.map((item) => (item.id === updatedEntry.id ? updatedEntry : item)),
        )
      }

      setContactReadStatusById((current) => ({
        ...current,
        [message.id]: result.message || 'Marked as read.',
      }))
    } catch (readError) {
      setContactReadStatusById((current) => ({
        ...current,
        [message.id]: readError?.message || 'Unable to mark as read.',
      }))
    } finally {
      setContactReadBusyById((current) => ({ ...current, [message.id]: false }))
    }
  }

  const handleSaveCommunityEvent = async (payload) => {
    if (!payload?.title || !payload?.detail) {
      throw new Error('Title and details are required.')
    }

    const busyKey = payload.eventId || `new-${Date.now()}`
    setCommunityEventBusyById((current) => ({ ...current, [busyKey]: true }))
    setCommunityEventStatusById((current) => ({ ...current, [busyKey]: '' }))

    try {
      const result = await createCommunityEvent(payload)
      const saved = result.communityEvent || null
      if (saved?.id) {
        setCommunityEvents((current) => {
          const filtered = current.filter((item) => item.id !== saved.id)
          filtered.unshift(saved)
          return filtered
        })
      }

      setCommunityEventStatusById((current) => ({
        ...current,
        [saved?.id || busyKey]: result.message || 'Community event saved.',
      }))
      await refreshRequests()
      return result
    } catch (eventError) {
      setCommunityEventStatusById((current) => ({
        ...current,
        [busyKey]: eventError?.message || 'Unable to save community event.',
      }))
      throw eventError
    } finally {
      setCommunityEventBusyById((current) => ({ ...current, [busyKey]: false }))
    }
  }

  const handleDeleteCommunityEvent = async (event) => {
    if (!event?.id) return

    setCommunityEventBusyById((current) => ({ ...current, [event.id]: true }))
    setCommunityEventStatusById((current) => ({ ...current, [event.id]: 'Deleting...' }))

    try {
      const result = await deleteCommunityEvent(event.id)
      setCommunityEvents((current) => current.filter((item) => item.id !== event.id))
      setCommunityEventStatusById((current) => ({
        ...current,
        [event.id]: result.message || 'Community event deleted.',
      }))
      await refreshRequests()
    } catch (eventError) {
      setCommunityEventStatusById((current) => ({
        ...current,
        [event.id]: eventError?.message || 'Unable to delete community event.',
      }))
    } finally {
      setCommunityEventBusyById((current) => ({ ...current, [event.id]: false }))
    }
  }

  return (
    <main className="priest-tools-page min-vh-100" data-bs-theme="dark">
      <section className="section-block pb-4">
        <div className="container-xxl">
          {auth.loading ? <div className="surface surface-pad">Loading access status...</div> : null}

          {!auth.loading && !auth.authenticated ? (
            <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-3">Locked</p>
              <h1 className="h3 mb-3">Open admin access first</h1>
              <p className="section-intro mb-4">
                The private tools page only opens after an admin account signs in.
              </p>
              <NavLink to="/priest-review" className="btn btn-primary rounded-pill px-4">
                Open admin login
              </NavLink>
            </div>
          ) : null}

          {!auth.loading && auth.authenticated ? (
            <div className="surface surface-strong surface-pad">
              <div className="row g-4 align-items-end">
                <div className="col-lg-8">
                  <p className="section-kicker mb-3">Private admin</p>
                  <h1 className="display-5 mb-3">Dashboard</h1>
                  <p className="section-intro mb-0">
                    Review incoming requests, then open the separate payment request or custom payment page when it is time to send a payment link.
                  </p>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                  <span className="badge text-bg-light border text-dark">
                      Role: {isSuperAdmin ? 'Super admin' : adminPermissions.role === 'owner' ? 'Owner' : 'Staff'}
                    </span>
                    <span className="badge text-bg-light border text-dark">Order audit log enabled</span>
                    {adminUser?.officer ? <span className="badge text-bg-success">{adminUser.officer.name}</span> : null}
                  </div>
                </div>
                <div className="col-lg-4">
                  <div className="d-grid gap-2">
                    <button type="button" className="btn admin-refresh-btn rounded-pill px-4" onClick={refreshAuth}>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>

              <div className="site-dashboard-tabs mt-4">
                {dashboardTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeTab === tab.id ? 'site-dashboard-tab is-active' : 'site-dashboard-tab'}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' ? <span className="site-dashboard-tab-count">{tab.count}</span> : null}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' ? (
                <>
                  <div className="surface surface-soft surface-pad mt-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                      <div>
                        <p className="section-kicker mb-2">Overview</p>
                        <h2 className="h4 mb-0">Operational summary</h2>
                      </div>
                    </div>
                    <div className="row g-3">
                      <div className="col-12 col-lg-6">
                        <div className="surface surface-soft surface-pad h-100">
                          <div className="small text-secondary mb-2">Dashboard status</div>
                          <div className="fw-semibold">Live data is available in the Diagnostics tab.</div>
                        </div>
                      </div>
                      <div className="col-12 col-lg-6">
                        <div className="surface surface-soft surface-pad h-100">
                          <div className="small text-secondary mb-2">Current focus</div>
                          <div className="fw-semibold">Manage officers, inbox, community events, and support work from here.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {activeTab === 'titles' ? (
                <div className="surface surface-strong surface-pad mt-4">
                  {isSuperAdmin ? (
                    <>
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                        <div>
                          <p className="section-kicker mb-2">Admin titles</p>
                          <h2 className="h4 mb-0">Assign officer titles</h2>
                        </div>
                      </div>
                      <div className="row g-3">
                        {adminUsers.map((adminProfile) => {
                          const draft = adminProfileDrafts[adminProfile.id] || {
                            title: adminProfile.title || '',
                          }

                          return (
                            <div className="col-12" key={adminProfile.id}>
                              <div className="surface surface-soft surface-pad">
                                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                                  <div className="blog-composer-head mb-0">
                                    <ProfileAvatar name={adminProfile.name} photoUrl={adminProfile.photoUrl} />
                                    <div>
                                      <strong>{adminProfile.name}</strong>
                                      <span>{adminProfile.email}</span>
                                    </div>
                                  </div>
                                  <span className="badge text-bg-light border text-dark">
                                    {adminProfile.isSuperAdmin ? 'Super admin' : 'Admin'}
                                  </span>
                                </div>
                                <div className="row g-3 align-items-end">
                                  <div className="col-md-5">
                                    <label className="form-label">Officer title</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={draft.title}
                                      onChange={(event) =>
                                        setAdminProfileDrafts((current) => ({
                                          ...current,
                                          [adminProfile.id]: {
                                            ...draft,
                                            title: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Temple secretary, event lead, ..."
                                    />
                                  </div>
                                  <div className="col-md-5">
                                    <div className="small text-secondary">
                                      Use Edit profile for your own photo and credentials. Super admins assign officer titles
                                      here.
                                    </div>
                                  </div>
                                  <div className="col-md-2 d-grid">
                                    <button
                                      type="button"
                                      className="btn btn-primary rounded-pill px-3"
                                      disabled={Boolean(adminProfileBusyById[adminProfile.id])}
                                      onClick={() => handleSaveAdminProfile(adminProfile)}
                                    >
                                      {adminProfileBusyById[adminProfile.id] ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                                {adminProfileStatusById[adminProfile.id] ? (
                                  <div className="small text-secondary mt-3">{adminProfileStatusById[adminProfile.id]}</div>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="surface surface-soft surface-pad">
                      Admin title editing is available to super admins only.
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === 'inbox' ? (
                <>
                  <ContactMessagesPanel
                    messages={visibleContactMessages}
                    currentOfficerId={currentOfficerId}
                    replyDrafts={contactReplyDrafts}
                    replyBusyById={contactReplyBusyById}
                    replyStatusById={contactReplyStatusById}
                    deleteBusyById={contactDeleteBusyById}
                    deleteStatusById={contactDeleteStatusById}
                    readBusyById={contactReadBusyById}
                    readStatusById={contactReadStatusById}
                    onReplyDraftChange={handleContactReplyDraftChange}
                    onMarkRead={handleMarkContactMessageRead}
                    onReply={handleReplyContactMessage}
                    onDelete={handleDeleteContactMessage}
                  />
                  <TempleLettersPanel subscribers={newsletters} />
                </>
              ) : null}

              {activeTab === 'community' ? (
                <>
                  <CommunityEventsPanel
                    events={communityEvents}
                    saveStatusById={communityEventStatusById}
                    deleteBusyById={communityEventBusyById}
                    deleteStatusById={communityEventStatusById}
                    onSave={handleSaveCommunityEvent}
                    onDelete={handleDeleteCommunityEvent}
                  />
                  <CommunityRsvpsPanel rsvps={rsvps} />
                </>
              ) : null}

              {activeTab === 'support' ? (
                <>
                  <div className="surface surface-pad mt-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                      <div>
                        <p className="section-kicker mb-2">Support queue</p>
                        <h2 className="h4 mb-0">Open cancellation and refund requests</h2>
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge text-bg-warning text-dark">{supportCount} open</span>
                        <span className="badge text-bg-light border text-dark">{refundCount} refunded</span>
                      </div>
                    </div>
                  </div>

                  {supportRequests.length ? (
                    <div className="row g-4 mb-4 mt-0">
                      {supportRequests.map((request) => (
                        <SupportRequestCard
                          key={`support-${request.id || `${request.createdAt}-${request.email}`}`}
                          request={request}
                          supportLabel={getSupportLabel(request)}
                          refundBusy={Boolean(refundBusyById[request.id])}
                          cancellationBusy={Boolean(cancellationBusyById[request.id])}
                          refundStatus={refundStatusById[request.id] || ''}
                          cancellationStatus={cancellationStatusById[request.id] || ''}
                          orderSyncBusy={Boolean(orderSyncBusyById[request.id])}
                          orderSyncStatus={orderSyncStatusById[request.id] || ''}
                          onOpenRecord={() => navigate(`/order/${encodeURIComponent(request.orderCode || request.id || '')}`)}
                          onProcessRefund={() => handleProcessRefund(request)}
                          onProcessCancellation={() => handleProcessCancellation(request)}
                          onSyncOrder={() => handleSyncOrder(request)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="surface surface-pad mt-4">No open support requests.</div>
                  )}

                  <div className="surface surface-pad mt-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                      <div>
                        <p className="section-kicker mb-2">Service requests</p>
                        <h2 className="h4 mb-0">Incoming requests</h2>
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge text-bg-secondary">{sortedRequests.length} requests</span>
                        <span className="badge text-bg-light border text-dark">{sentCount} sent</span>
                      </div>
                    </div>
                  </div>

                  {error ? <div className="alert alert-danger mt-4">{error}</div> : null}
                  {loading ? <div className="surface surface-pad mt-4">Loading requests...</div> : null}

                  {!loading && sortedRequests.length === 0 ? (
                    <div className="surface surface-pad mt-4">No service requests yet.</div>
                  ) : null}

                  <div className="row g-4 mt-0">
                    {sortedRequests.map((request) => (
                      <ServiceRequestCard
                        key={request.id || `${request.createdAt}-${request.email}`}
                        request={request}
                        completionBusy={Boolean(completionBusyById[request.id])}
                        refundBusy={Boolean(refundBusyById[request.id])}
                        completionStatus={completionStatusById[request.id] || ''}
                        refundStatus={refundStatusById[request.id] || ''}
                        orderSyncBusy={Boolean(orderSyncBusyById[request.id])}
                        orderSyncStatus={orderSyncStatusById[request.id] || ''}
                        onMarkComplete={() => handleMarkComplete(request)}
                        onProcessRefund={() => handleProcessRefund(request)}
                        onSyncOrder={() => handleSyncOrder(request)}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {activeTab === 'analytics' ? (
                <SiteAnalyticsPanel
                  orders={sortedRequests}
                  newsletters={newsletters}
                  rsvps={rsvps}
                  communityEvents={communityEvents}
                  contactMessages={contactMessages}
                  blogPosts={blogPosts}
                  analytics={analyticsSnapshot}
                />
              ) : null}

              {activeTab === 'diagnostics' ? (
                <>
                  {adminPermissions.canViewSquareSync ? (
                    <details className="surface surface-soft surface-pad mt-4">
                      <summary className="h6 mb-0 cursor-pointer">Square sync</summary>
                      <div className="mt-3">
                        <SquareSyncPanel
                          syncStatus={syncStatus}
                          syncBusy={syncBusy}
                          syncMessage={syncMessage}
                          onSync={handleSyncSquare}
                        />
                      </div>
                    </details>
                  ) : null}

                  {adminPermissions.canViewAdminAccessRequests ? (
                    <AdminAccessRequestsPanel requests={adminAccessRequests} />
                  ) : null}
                  {adminPermissions.isSuperAdmin ? (
                    <>
                      <ApiMetricsPanel
                        metrics={apiMetrics}
                        onRefresh={refreshMetrics}
                        refreshBusy={metricsBusy}
                        refreshError={metricsError}
                        onResolveAlert={handleResolveAlert}
                        resolvingAlertIds={resolvingAlertById}
                      />
                      <AdminAuditLogPanel events={adminAuditEvents} />
                      <ClientErrorLogPanel errors={clientErrorEvents} />
                    </>
                  ) : null}
                  <OrderEventLogPanel events={recentEvents} />
                </>
              ) : null}

            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default PriestToolsPage
