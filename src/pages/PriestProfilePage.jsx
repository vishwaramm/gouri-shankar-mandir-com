import { useCallback, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ProfileAvatar } from '../components/ProfileAvatar.jsx'
import {
  loadPriestAuthStatus,
  updateAdminUserCredentials,
  updateAdminUserProfile,
  uploadAdminProfilePhoto,
} from '../lib/siteApi.js'

function PriestProfilePage() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
  })
  const [adminUser, setAdminUser] = useState(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profilePhotoFile, setProfilePhotoFile] = useState(null)
  const [profilePhotoInputKey, setProfilePhotoInputKey] = useState(0)
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false)
  const [profilePhotoStatus, setProfilePhotoStatus] = useState('')
  const [titleBusy, setTitleBusy] = useState(false)
  const [titleStatus, setTitleStatus] = useState('')
  const [credentialsBusy, setCredentialsBusy] = useState(false)
  const [credentialsStatus, setCredentialsStatus] = useState('')

  const refreshAuth = useCallback(async () => {
    const status = await loadPriestAuthStatus()
    setAuth({
      loading: false,
      authenticated: Boolean(status.authenticated),
    })
    setAdminUser(status.user || null)
    setTitleDraft(status.user?.title || status.user?.officer?.role || '')
    setEmailDraft(status.user?.email || '')
    return status
  }, [])

  useEffect(() => {
    refreshAuth()
      .then((status) => {
        if (!status.authenticated) {
          navigate('/priest-review', { replace: true })
        }
      })
      .catch(() => {
        setAuth({ loading: false, authenticated: false })
        navigate('/priest-review', { replace: true })
      })
  }, [navigate, refreshAuth])

  const handleSaveOwnPhoto = async () => {
    if (!adminUser?.id || !profilePhotoFile) return

    setProfilePhotoBusy(true)
    setProfilePhotoStatus('')

    try {
      const result = await uploadAdminProfilePhoto(profilePhotoFile)
      setAdminUser(result.user || null)
      setProfilePhotoStatus(result.message || 'Profile photo updated.')
      setProfilePhotoFile(null)
      setProfilePhotoInputKey((current) => current + 1)
      await refreshAuth()
    } catch (profileError) {
      setProfilePhotoStatus(profileError?.message || 'Unable to update profile photo.')
    } finally {
      setProfilePhotoBusy(false)
    }
  }

  const handleSaveTitle = async () => {
    if (!adminUser?.id) return

    setTitleBusy(true)
    setTitleStatus('')

    try {
      const result = await updateAdminUserProfile({
        adminUserId: adminUser.id,
        title: titleDraft,
      })

      setAdminUser(result.user || null)
      setTitleDraft(result.user?.title || result.user?.officer?.role || '')
      setTitleStatus(result.message || 'Title updated.')
      await refreshAuth()
    } catch (titleError) {
      setTitleStatus(titleError?.message || 'Unable to update title.')
    } finally {
      setTitleBusy(false)
    }
  }

  const handleSaveCredentials = async () => {
    if (!adminUser?.id) return

    setCredentialsBusy(true)
    setCredentialsStatus('')

    try {
      const result = await updateAdminUserCredentials({
        email: emailDraft,
        currentPassword,
        newPassword,
        confirmPassword,
      })

      setAdminUser(result.user || null)
      setEmailDraft(result.user?.email || emailDraft)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setCredentialsStatus(result.message || 'Credentials updated.')
      await refreshAuth()
    } catch (credentialError) {
      setCredentialsStatus(credentialError?.message || 'Unable to update credentials.')
    } finally {
      setCredentialsBusy(false)
    }
  }

  return (
    <main className="priest-tools-page min-vh-100" data-bs-theme="dark">
      <section className="section-block pb-4">
        <div className="container-xxl">
          {auth.loading ? <div className="surface surface-pad">Loading access status...</div> : null}

          {!auth.loading && auth.authenticated ? (
            <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '52rem' }}>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                  <p className="section-kicker mb-2">Admin</p>
                  <h1 className="display-6 mb-2">Edit profile</h1>
                  <p className="section-intro mb-0">
                    Update the photo and title attached to your admin account.
                  </p>
                </div>
                {profilePhotoStatus || titleStatus || credentialsStatus ? (
                  <div className="text-secondary">{profilePhotoStatus || titleStatus || credentialsStatus}</div>
                ) : null}
              </div>

              <div className="row g-4 align-items-start">
                <div className="col-md-6">
                  <label className="form-label">Choose a new photo</label>
                  <div className="photo-picker">
                    <input
                      key={profilePhotoInputKey}
                      id="admin-photo-input"
                      type="file"
                      className="visually-hidden"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => setProfilePhotoFile(event.target.files?.[0] || null)}
                    />
                    <div className="input-group photo-picker-group">
                      <label className="btn btn-outline-light photo-picker-button" htmlFor="admin-photo-input">
                        Choose file
                      </label>
                      <input
                        type="text"
                        className="form-control photo-picker-name"
                        readOnly
                        value={profilePhotoFile ? profilePhotoFile.name : 'No file selected'}
                        aria-label="Selected profile photo file"
                      />
                    </div>
                  </div>
                  <div className="small text-secondary mt-2">
                    {profilePhotoFile ? `Selected: ${profilePhotoFile.name}` : 'PNG, JPG, GIF, or WebP up to 5 MB.'}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="blog-composer-head mb-0 align-items-start">
                    <ProfileAvatar name={adminUser?.name || 'Admin'} photoUrl={adminUser?.photoUrl} />
                    <div className="flex-grow-1">
                      <strong>{adminUser?.name || 'Admin'}</strong>
                      <span>{adminUser?.title || adminUser?.officer?.role || 'Title not set'}</span>
                    </div>
                    <span className="badge text-bg-light border text-dark">
                      {adminUser?.isSuperAdmin ? 'Super admin' : 'Admin'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      placeholder="Temple secretary, event lead, ..."
                    />
                    <div className="small text-secondary mt-2">
                      This title appears with your posts. Super admins can still edit officer titles for other admins
                      from the dashboard.
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface surface-soft surface-pad mt-4">
                <p className="section-kicker mb-2">Credentials</p>
                <h2 className="h4 mb-3">Change login details</h2>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Email address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Current password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Enter your current password"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">New password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Leave blank to keep current password"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Confirm new password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat the new password"
                    />
                  </div>
                </div>
                <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4"
                    onClick={handleSaveCredentials}
                    disabled={credentialsBusy || !currentPassword || !emailDraft}
                  >
                    {credentialsBusy ? 'Saving credentials...' : 'Save credentials'}
                  </button>
                </div>
              </div>

              <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-outline-light rounded-pill px-4"
                  onClick={handleSaveTitle}
                  disabled={titleBusy || !adminUser?.id}
                >
                  {titleBusy ? 'Saving title...' : 'Save title'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-pill px-4"
                  onClick={handleSaveOwnPhoto}
                  disabled={profilePhotoBusy || !profilePhotoFile}
                >
                  {profilePhotoBusy ? 'Saving photo...' : 'Save photo'}
                </button>
              </div>

              <div className="mt-4">
                <NavLink to="/priest-tools" className="btn btn-outline-light rounded-pill px-4">
                  Back to dashboard
                </NavLink>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default PriestProfilePage
