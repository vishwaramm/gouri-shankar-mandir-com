import { historyMilestones, missionPillars, officers } from '../content.js'

function AboutPage() {
  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.2), rgba(10, 8, 7, 0.78)), url("/images/hindu-priests-yajna.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        <div className="hero-backdrop" />
        <div className="hero-veil" />
        <div className="container-xxl hero-grid">
          <div className="row align-items-end g-4">
            <div className="col-lg-8 col-xl-7">
              <div className="reveal">
                <p className="section-kicker text-white">About</p>
                <h1 className="hero-title text-white">The temple's story.</h1>
                <p className="hero-lede mt-4">Gourishankar Mandir preserves ritual depth for devotion, learning, and service.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell about-section">
        <div className="container-xxl">
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-6">
              <div className="surface surface-pad h-100">
                <p className="section-kicker">Mission</p>
                <h2 className="section-title mb-3">Accessible devotion.</h2>
                <p className="section-intro mb-4">
                  The mandir preserves Sanatan Dharma through worship, study, healing, and ritual support.
                </p>

                <div className="story-grid">
                  {missionPillars.map((pillar, index) => (
                    <article className="story-item reveal" key={pillar.title} style={{ animationDelay: `${index * 90}ms` }}>
                      <strong>0{index + 1}</strong>
                      <h3 className="h4">{pillar.title}</h3>
                      <p>{pillar.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="surface surface-pad h-100">
                <div className="image-frame mb-4">
                  <img
                    src="/images/hindu-temple-shrine.jpg"
                    alt="A Hindu temple shrine with quiet ceremonial atmosphere"
                  />
                </div>
                <p className="section-kicker">History</p>
                <h2 className="section-title mb-3">A line of worship and continuity.</h2>
                <p className="section-intro mb-4">Gourishankar Mandir bridges timeless tradition and daily life.</p>
                <div className="timeline-list">
                  {historyMilestones.map((milestone) => (
                    <div className="timeline-item" key={milestone.year}>
                      <time>{milestone.year}</time>
                      <p>{milestone.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block about-section">
        <div className="container-xxl">
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-5">
              <div className="surface surface-pad h-100">
                <div className="image-frame mb-4">
                  <img
                    src="/images/hindu-temple-architecture.jpg"
                    alt="A serene Hindu temple view with layered stone architecture"
                  />
                </div>
                <p className="section-kicker">Purpose</p>
                <h2 className="section-title mb-3">A home beyond distance.</h2>
                <p className="section-intro mb-0">
                  Darshan, learning, and satsang remain close at hand.
                </p>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="surface surface-strong surface-pad h-100">
                <p className="section-kicker">Leadership</p>
                <h2 className="section-title mb-4">Temple leadership.</h2>
                <div className="profile-grid">
                  {officers.map((officer, index) => (
                    <article className="profile-panel reveal" key={officer.name} style={{ animationDelay: `${index * 90}ms` }}>
                      <div className="profile-media">
                        <img src={officer.photo} alt={`Portrait for ${officer.name}`} />
                      </div>
                      <div className="profile-body">
                        <span className="profile-role">{officer.role}</span>
                        <h3 className="h4">{officer.name}</h3>
                        <p>{officer.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AboutPage
