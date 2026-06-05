export default function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.04] ${className}`.trim()}
    >
      <div className='p-5'>{children}</div>
    </section>
  )
}
