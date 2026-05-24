export default function Card({ children, className = '' }) {
  return <section className={`rounded-xl border border-border bg-surface p-5 ${className}`.trim()}>{children}</section>
}
