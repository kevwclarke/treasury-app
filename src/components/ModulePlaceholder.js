import './ModulePlaceholder.css'

export function ModulePlaceholder({ title, description }) {
  return (
    <div className="module-placeholder">
      <h1 className="module-placeholder__title">{title}</h1>
      <p className="module-placeholder__body">
        {description ??
          'This module is coming soon. Treasury Autopilot views will appear here.'}
      </p>
    </div>
  )
}
