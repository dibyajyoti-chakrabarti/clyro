import { CheckCircle2, Zap } from 'lucide-react'

const checklist = [
  'AI-generated architecture diagrams',
  'Automatic AWS provisioning',
  'Cost, performance & security insights',
  'Real-time monitoring & alerts',
  'Built-in best practices',
]

export default function BuiltForEngineers() {
  return (
    <section id='company' className='bg-marketing-dark px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
      <div className='mx-auto grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-2 lg:gap-14'>
        <div>
          <span className='inline-flex items-center gap-2 rounded-full border border-marketing-amber-border bg-marketing-amber-soft px-4 py-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-marketing-amber'>
            <Zap size={13} strokeWidth={2} />
            Built for Developers
          </span>

          <h2 className='mt-5 text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'>
            Everything you need to <span className='text-marketing-amber'>build and run</span> in the
            cloud.
          </h2>

          <ul className='mt-8 flex flex-col gap-3.5'>
            {checklist.map((item) => (
              <li key={item} className='flex items-center gap-3'>
                <CheckCircle2 size={19} strokeWidth={1.8} className='shrink-0 text-marketing-amber' />
                <span className='text-[1rem] text-marketing-ink'>{item}</span>
              </li>
            ))}
          </ul>

          <a
            href='#features'
            className='mt-9 inline-flex h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-6 text-[0.9rem] font-semibold text-marketing-ink transition-colors hover:border-white/35 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber'
          >
            Explore All Features
            <span aria-hidden='true'>→</span>
          </a>
        </div>

        <div>
          <div className='overflow-hidden rounded-2xl border border-white/10 bg-marketing-dark-surface'>
            <div className='flex items-center gap-1.5 border-b border-white/10 px-4 py-3'>
              <span className='size-2.5 rounded-full bg-white/20' />
              <span className='size-2.5 rounded-full bg-white/20' />
              <span className='size-2.5 rounded-full bg-white/20' />
            </div>
            <div className='flex aspect-[3/2] w-full items-center justify-center bg-white/[0.03]'>
              <span className='text-[0.8rem] font-medium uppercase tracking-wide text-marketing-muted'>
                placeholder
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
