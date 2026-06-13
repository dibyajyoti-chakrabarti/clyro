// Content region for a wizard step body. Replaces the dashed-border wrappers the
// wizard used previously with neutral spacing, so the step's own card carries the
// visual weight (less nested-border clutter; aesthetic & minimalist design).
export function WizardPanel({ children, className = '' }) {
  return <div className={`mt-6 flex-1 ${className}`.trim()}>{children}</div>
}

const widthClasses = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  full: '',
}

// Standard surface card matching the app's card treatment (Card.jsx / AppLayout).
// `width` constrains and centres narrow forms; `full` lets callers size it.
export function WizardCard({ children, className = '', width = 'md' }) {
  return (
    <div
      className={`mx-auto ${widthClasses[width]} rounded-xl border border-white/[0.07] bg-surface p-6 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04] ${className}`.trim()}
    >
      {children}
    </div>
  )
}
