import { useMemo, useState } from 'react'
import { blogPosts, courses, educationItems, educationThemes, videoLibrary } from '../content.js'

function EducationPage() {
  const [educationTab, setEducationTab] = useState('Teachings')
  const educationViews = useMemo(
    () => ({
      Teachings: blogPosts,
      Study: courses,
      Lectures: videoLibrary,
    }),
    [],
  )

  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.18), rgba(10, 8, 7, 0.8)), url("/images/temple-public-library.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        <div className="hero-backdrop" />
        <div className="hero-veil" />
        <div className="container-xxl hero-grid">
          <div className="row align-items-end g-5">
            <div className="col-lg-7">
              <div className="reveal">
                <p className="section-kicker text-white">Education</p>
                <h1 className="hero-title text-white">Learning and reflection.</h1>
                <p className="hero-lede mt-4">Teachings on scripture, meditation, and devotional life.</p>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="surface surface-strong surface-pad reveal delay-1">
                <div className="image-frame mb-4">
                  <img
                    src="/images/hindu-temple-shrine.jpg"
                    alt="A peaceful study space with books and warm daylight"
                  />
                </div>
                <p className="section-kicker">Learning mode</p>
                <h2 className="h3 mb-3">Study, reflect, return to practice.</h2>
                <p className="section-intro mb-0">Study, reflect, return to practice.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="surface surface-pad mb-4">
            <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3">
              <div>
                <p className="section-kicker">Learning</p>
                <h2 className="section-title mb-0">Ways of learning.</h2>
              </div>
              <div className="filter-dock">
                {Object.keys(educationViews).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={educationTab === tab ? 'btn btn-primary' : 'btn btn-outline-primary'}
                    onClick={() => setEducationTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="row g-4 align-items-stretch">
            <div className="col-lg-4">
              <div className="surface surface-strong surface-pad h-100">
                <p className="section-kicker">Study paths</p>
                <h2 className="section-title mb-3">Read with clear devotional purpose.</h2>
                <div className="timeline-list">
                  {educationItems.map((item, index) => (
                    <div className="timeline-item" key={item}>
                      <time>0{index + 1}</time>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="surface surface-pad h-100">
                <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
                  <div>
                    <p className="section-kicker mb-2">{educationTab}</p>
                    <h2 className="section-title mb-0">Curated teaching.</h2>
                  </div>
                  <p className="section-intro mb-0 text-lg-end">
                    {educationTab === 'Teachings'
                      ? 'Short reflections and commentary.'
                      : educationTab === 'Study'
                        ? 'Structured study and practice.'
                        : 'Guided lectures and meditations.'}
                  </p>
                </div>

                <div className="archive-grid service-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  {educationViews[educationTab].map((item, index) => (
                    <article className="archive-entry reveal" key={item.title} style={{ animationDelay: `${index * 70}ms` }}>
                      <div className="profile-body">
                        <span className="archive-label">{item.tag || 'Teaching'}</span>
                        <h3 className="h5">{item.title}</h3>
                        <p>{item.detail || 'Available for seekers who want deeper practice.'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="surface surface-strong surface-pad mt-4">
            <p className="section-kicker">Study themes</p>
            <div className="story-grid">
              {educationThemes.map((theme, index) => (
                <article className="story-item" key={theme}>
                  <strong>0{index + 1}</strong>
                  <p>{theme}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default EducationPage
