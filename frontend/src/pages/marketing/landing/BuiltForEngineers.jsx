import { Check, Zap } from 'lucide-react'

const checklist = [
  'AI-generated architecture diagrams',
  'Automatic AWS provisioning',
  'Cost, performance & security insights',
  'Real-time monitoring & alerts',
  'Built-in best practices',
]

export default function BuiltForEngineers() {
  return (
    <section id='company' className='bg-[#0C0E17] px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
      <div className='mx-auto grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-2 lg:gap-14'>
        <div>
          <span
            className='inline-flex items-center gap-2 rounded-full border-2 border-black bg-marketing-bronze px-4 py-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-marketing-cream-2'
            style={{ transform: 'rotate(-2deg)' }}
          >
            <Zap size={13} strokeWidth={2} />
            Built for Developers
          </span>

          <h2 className='mt-5 text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'>
            Everything you need to <span className='text-marketing-amber-2'>build and run</span> in the
            cloud.
          </h2>

          <ul className='mt-8 flex flex-col gap-3.5'>
            {checklist.map((item) => (
              <li key={item} className='flex items-center gap-3'>
                <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-marketing-amber-core'>
                  <Check size={14} strokeWidth={3} className='text-black' />
                </span>
                <span className='text-[1rem] text-marketing-ink'>{item}</span>
              </li>
            ))}
          </ul>

          <a
            href='#features'
            className='mt-9 inline-flex h-[48px] items-center justify-center gap-2 rounded-xl border border-marketing-border-hairline bg-white/[0.02] px-6 text-[0.9rem] font-semibold text-marketing-ink transition-colors hover:border-white/35 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber-2'
          >
            Explore All Features
            <span aria-hidden='true'>→</span>
          </a>
        </div>

        <div>
          <div className='overflow-hidden rounded-2xl border border-marketing-border-hairline bg-marketing-bg-card'>
            <div className='flex items-center gap-1.5 border-b border-marketing-border-hairline px-4 py-3'>
              <span className='size-2.5 rounded-full bg-white/20' />
              <span className='size-2.5 rounded-full bg-white/20' />
              <span className='size-2.5 rounded-full bg-white/20' />
            </div>
            <div className='flex aspect-[3/2] w-full items-center justify-center bg-marketing-bg-elevated'>
              <span className='text-[0.8rem] font-medium uppercase tracking-wide text-marketing-text-muted-2'>
                placeholder
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
