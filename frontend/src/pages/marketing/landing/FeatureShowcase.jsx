import {
  BadgeCheck,
  BellRing,
  Bot,
  Calculator,
  Rocket,
  Workflow,
} from 'lucide-react'

const features = [
  { icon: Bot, title: 'AI Guidance', body: 'Smart recommendations at every step.' },
  {
    icon: BadgeCheck,
    title: 'Best Practice Check',
    body: 'Built-in checks for security, reliability, and performance.',
  },
  { icon: Workflow, title: 'Visual Architecture', body: 'Interactive diagrams that are easy to edit.' },
  { icon: Rocket, title: 'One-Click Deployment', body: 'Deploy your entire stack with a single click.' },
  { icon: Calculator, title: 'Cost Estimation', body: 'Real-time cost estimates with breakdowns.' },
  { icon: BellRing, title: 'Monitoring & Alerts', body: 'Monitor resources and get proactive alerts.' },
]

export default function FeatureShowcase() {
  return (
    <section id='features' className='bg-marketing-dark px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
      <div className='mx-auto grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-2 lg:gap-14'>
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

        <div>
          <h2 className='text-[2rem] font-bold tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'>
            Feature <span className='text-marketing-amber'>Showcase</span>
          </h2>
          <p className='mt-3 max-w-[26rem] text-[1.375rem] leading-[1.7] text-marketing-muted'>
            Everything you need to design, validate, and deploy cloud architectures.
          </p>

          <ul className='mt-9 grid gap-x-7 gap-y-7 sm:grid-cols-2'>
            {features.map((feature) => (
              <li key={feature.title} className='flex gap-3.5'>
                <span className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-marketing-amber'>
                  <feature.icon size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className='text-[1rem] font-bold text-marketing-ink'>{feature.title}</h3>
                  <p className='mt-1 text-[0.85rem] leading-[1.55] text-marketing-muted'>{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
