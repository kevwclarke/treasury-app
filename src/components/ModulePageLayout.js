import './ModulePageLayout.css'

/**
 * Universal module shell: hero → Next Best Actions (optional) → 2×2 quadrants.
 * Quadrants: Your position · Intelligence · Breakdown · Actions & settings
 */
export function ModulePageLayout({ title, subtitle, trustNote, nextBestActions, position, intelligence, breakdown, actionsSettings }) {
  return (
    <div className="module-page">
      <header className="module-page__header">
        <h1 className="module-page__title">{title}</h1>
        {subtitle ? <p className="module-page__sub">{subtitle}</p> : null}
        {trustNote ? <p className="module-page__trust">{trustNote}</p> : null}
      </header>

      {nextBestActions ? <div className="module-page__nba">{nextBestActions}</div> : null}

      <div className="module-page__grid" aria-label="Module analysis">
        <section className="module-q" aria-labelledby="module-q-position">
          <h2 id="module-q-position" className="module-q__h">
            Your position
          </h2>
          <div className="module-q__body">{position}</div>
        </section>
        <section className="module-q" aria-labelledby="module-q-intel">
          <h2 id="module-q-intel" className="module-q__h">
            Intelligence
          </h2>
          <div className="module-q__body">{intelligence}</div>
        </section>
        <section className="module-q" aria-labelledby="module-q-breakdown">
          <h2 id="module-q-breakdown" className="module-q__h">
            Breakdown
          </h2>
          <div className="module-q__body">{breakdown}</div>
        </section>
        <section className="module-q" aria-labelledby="module-q-actions">
          <h2 id="module-q-actions" className="module-q__h">
            Actions &amp; settings
          </h2>
          <div className="module-q__body">{actionsSettings}</div>
        </section>
      </div>
    </div>
  )
}
