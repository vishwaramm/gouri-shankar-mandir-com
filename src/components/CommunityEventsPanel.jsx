import { useMemo, useState } from 'react'
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api'

function formatDateTime(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function formatEventDate(value) {
  if (!value) return 'Unset'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildGoogleMapsLink(event) {
  if (event.mapsUrl) return event.mapsUrl
  if (!event.address) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
}

function createEmptyDraft() {
  return {
    eventId: '',
    title: '',
    detail: '',
    section: 'events',
    kind: 'recurring',
    scheduleLabel: '',
    eventDate: '',
    inPerson: false,
    address: '',
    placeId: '',
    latitude: '',
    longitude: '',
    mapsUrl: '',
  }
}

export function CommunityEventsPanel({
  events = [],
  saveStatusById = {},
  deleteBusyById = {},
  deleteStatusById = {},
  onSave,
  onDelete,
}) {
  const [draft, setDraft] = useState(createEmptyDraft)
  const [formBusy, setFormBusy] = useState(false)
  const [formStatus, setFormStatus] = useState('')
  const [autocompleteInstance, setAutocompleteInstance] = useState(null)

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey,
    libraries: ['places'],
    preventGoogleFontsLoading: true,
  })

  const sortedEvents = useMemo(() => {
    return [...events].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  }, [events])

  const isEditing = Boolean(draft.eventId)

  const populateDraft = (event) => {
    setDraft({
      eventId: event.id || '',
      title: event.title || '',
      detail: event.detail || '',
      section: event.section || 'events',
      kind: event.kind || 'recurring',
      scheduleLabel: event.scheduleLabel || '',
      eventDate: event.eventDate || '',
      inPerson: Boolean(event.inPerson),
      address: event.address || '',
      placeId: event.placeId || '',
      latitude: Number.isFinite(event.latitude) ? String(event.latitude) : '',
      longitude: Number.isFinite(event.longitude) ? String(event.longitude) : '',
      mapsUrl: event.mapsUrl || '',
    })
    setFormStatus('')
  }

  const resetDraft = () => {
    setDraft(createEmptyDraft())
    setFormStatus('')
  }

  const handlePlaceChanged = () => {
    if (!autocompleteInstance) return
    const place = autocompleteInstance.getPlace()
    if (!place) return

    const latitude = place.geometry?.location?.lat?.()
    const longitude = place.geometry?.location?.lng?.()

    setDraft((current) => ({
      ...current,
      address: place.formatted_address || place.name || current.address,
      placeId: place.place_id || current.placeId,
      latitude: Number.isFinite(latitude) ? String(latitude) : current.latitude,
      longitude: Number.isFinite(longitude) ? String(longitude) : current.longitude,
      mapsUrl: place.url || current.mapsUrl,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormBusy(true)
    setFormStatus('')

    try {
      const result = await onSave?.({
        eventId: draft.eventId,
        title: draft.title.trim(),
        detail: draft.detail.trim(),
        section: draft.section,
        kind: draft.kind,
        scheduleLabel: draft.kind === 'recurring' ? draft.scheduleLabel.trim() : '',
        eventDate: draft.kind === 'ad-hoc' ? draft.eventDate : '',
        inPerson: draft.inPerson,
        address: draft.inPerson ? draft.address.trim() : '',
        placeId: draft.inPerson ? draft.placeId.trim() : '',
        latitude: draft.inPerson && draft.latitude !== '' ? Number(draft.latitude) : '',
        longitude: draft.inPerson && draft.longitude !== '' ? Number(draft.longitude) : '',
        mapsUrl: draft.inPerson ? draft.mapsUrl.trim() : '',
      })

      setFormStatus(result?.message || 'Community event saved.')
      resetDraft()
    } catch (error) {
      setFormStatus(error?.message || 'Unable to save the event.')
    } finally {
      setFormBusy(false)
    }
  }

  return (
    <div className="surface surface-pad mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="section-kicker mb-2">Community</div>
          <div className="h5 mb-1">Events</div>
          <p className="mb-0 text-secondary">
            Add recurring gatherings or dated announcements for the Community page.
          </p>
        </div>
        <span className="badge text-bg-light border text-dark">{sortedEvents.length} events</span>
      </div>

      <form className="surface surface-strong surface-pad mt-3" onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-lg-6">
            <label className="form-label fw-semibold">Title</label>
            <input
              type="text"
              className="form-control"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Temple meditation circle"
              required
            />
          </div>
          <div className="col-lg-6">
            <label className="form-label fw-semibold">Section</label>
            <select
              className="form-select"
              value={draft.section}
              onChange={(event) => setDraft((current) => ({ ...current, section: event.target.value }))}
            >
              <option value="events">Upcoming gatherings</option>
              <option value="observances">Observances</option>
            </select>
          </div>
          <div className="col-lg-6">
            <label className="form-label fw-semibold">Type</label>
            <select
              className="form-select"
              value={draft.kind}
              onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}
            >
              <option value="recurring">Recurring</option>
              <option value="ad-hoc">Ad-hoc</option>
            </select>
          </div>
          <div className="col-lg-6">
            <label className="form-label fw-semibold">Delivery</label>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn rounded-pill px-3 ${draft.inPerson ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setDraft((current) => ({ ...current, inPerson: true }))}
              >
                In person
              </button>
              <button
                type="button"
                className={`btn rounded-pill px-3 ${!draft.inPerson ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setDraft((current) => ({ ...current, inPerson: false }))}
              >
                Virtual
              </button>
            </div>
          </div>

          {draft.kind === 'recurring' ? (
            <div className="col-lg-6">
              <label className="form-label fw-semibold">Schedule label</label>
              <input
                type="text"
                className="form-control"
                value={draft.scheduleLabel}
                onChange={(event) => setDraft((current) => ({ ...current, scheduleLabel: event.target.value }))}
                placeholder="Weekly, Sundays at 8:00 AM"
                required
              />
            </div>
          ) : (
            <div className="col-lg-6">
              <label className="form-label fw-semibold">Date</label>
              <input
                type="date"
                className="form-control"
                value={draft.eventDate}
                onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value }))}
                required
              />
            </div>
          )}

          <div className="col-12">
            <label className="form-label fw-semibold">Details</label>
            <textarea
              className="form-control"
              rows="3"
              value={draft.detail}
              onChange={(event) => setDraft((current) => ({ ...current, detail: event.target.value }))}
              placeholder="A short note that will appear on the Community page."
              required
            />
          </div>

          {draft.inPerson ? (
            <div className="col-12">
              <label className="form-label fw-semibold">Address</label>
              {googleMapsApiKey && mapsLoaded ? (
                <Autocomplete
                  onLoad={(instance) => setAutocompleteInstance(instance)}
                  onPlaceChanged={handlePlaceChanged}
                  options={{
                    types: ['address'],
                  }}
                  fields={['formatted_address', 'geometry', 'name', 'place_id', 'url']}
                >
                  <input
                    type="text"
                    className="form-control"
                    value={draft.address}
                    onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Start typing a proper address"
                    required
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  className="form-control"
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Enter the full address"
                  required
                />
              )}
              <div className="small text-secondary mt-2">
                {googleMapsApiKey && mapsLoaded
                  ? 'Select an address from Google Maps suggestions so the location is accurate.'
                  : 'Set VITE_GOOGLE_MAPS_API_KEY to enable Google address suggestions.'}
              </div>
            </div>
          ) : null}

          <div className="col-12 d-flex flex-wrap gap-2 align-items-center">
            <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={formBusy}>
              {formBusy ? 'Saving...' : isEditing ? 'Update event' : 'Add event'}
            </button>
            <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={resetDraft} disabled={formBusy}>
              Reset
            </button>
            <span className="small text-secondary">
              {draft.kind === 'ad-hoc'
                ? 'Ad-hoc events are removed after the date passes.'
                : 'Recurring events stay on the page until removed.'}
            </span>
          </div>
        </div>
        {formStatus ? <div className="small text-secondary mt-3">{formStatus}</div> : null}
      </form>

      <div className="timeline-list mt-4">
        {sortedEvents.length ? (
          sortedEvents.map((event) => (
            <article className="timeline-item" key={event.id}>
              <time>{event.kind === 'ad-hoc' ? formatEventDate(event.eventDate) : event.scheduleLabel || 'Recurring'}</time>
              <div className="w-100">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                  <div>
                    <h4 className="h5 mb-1">{event.title}</h4>
                    <p className="mb-1 text-secondary">{event.detail}</p>
                    {event.inPerson ? (
                      <div className="small text-secondary">
                        <div className="fw-semibold">In person</div>
                        {event.address ? <div className="text-break">{event.address}</div> : null}
                        {buildGoogleMapsLink(event) ? (
                          <a
                            className="link-light text-decoration-underline"
                            href={buildGoogleMapsLink(event)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Google Maps
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mb-0 small text-secondary">Virtual</p>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-light btn-sm rounded-pill px-3"
                      onClick={() => populateDraft(event)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-light btn-sm rounded-pill px-3"
                      disabled={Boolean(deleteBusyById[event.id])}
                      onClick={() => onDelete?.(event)}
                    >
                      {deleteBusyById[event.id] ? 'Removing...' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div className="small text-secondary mt-2">
                  {event.section === 'observances' ? 'Observances' : 'Upcoming gatherings'}
                  {event.kind === 'ad-hoc' ? ' · Ad-hoc' : ' · Recurring'}
                </div>
                <div className="small text-secondary mt-1">Created {formatDateTime(event.createdAt)}</div>
                {saveStatusById[event.id] || deleteStatusById[event.id] ? (
                  <div className="small text-secondary mt-2">
                    {saveStatusById[event.id] || deleteStatusById[event.id]}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="surface surface-soft surface-pad">No community events yet.</div>
        )}
      </div>
    </div>
  )
}
