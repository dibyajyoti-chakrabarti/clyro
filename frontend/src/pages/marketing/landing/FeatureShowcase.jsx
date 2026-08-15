import {
  BadgeCheck,
  BellRing,
  Bot,
  Calculator,
  Rocket,
  Workflow,
} from 'lucide-react'

const features = [
  {
    icon: Bot,
    title: 'AI Guidance',
    body: 'Smart recommendations at every step.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: BadgeCheck,
    title: 'Best Practice Check',
    body: 'Built-in checks for security, reliability, and performance.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: Workflow,
    title: 'Visual Architecture',
    body: 'Interactive diagrams that are easy to edit.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: Rocket,
    title: 'One-Click Deployment',
    body: 'Deploy your entire stack with a single click.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: Calculator,
    title: 'Cost Estimation',
    body: 'Real-time cost estimates with breakdowns.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: BellRing,
    title: 'Monitoring & Alerts',
    body: 'Monitor resources and get proactive alerts.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
]

export default function FeatureShowcase() {
  return (
    <section id='features' className='bg-marketing-gold-pale px-5 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14'>
      <div className='mx-auto w-[99%] rounded-2xl bg-marketing-near-black p-6 lg:rounded-3xl lg:p-10'>
        <div className='grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12'>
          <div>
            <div className='overflow-hidden rounded-2xl border-2 border-marketing-bronze bg-marketing-bg-card'>
              <div className='flex items-center gap-1.5 border-b border-marketing-border-hairline px-4 py-3'>
                <span className='size-2.5 rounded-full bg-marketing-text-muted-2' />
                <span className='size-2.5 rounded-full bg-marketing-text-muted-2' />
                <span className='size-2.5 rounded-full bg-marketing-text-muted-2' />
              </div>
              <div className='flex aspect-[3/2] w-full items-center justify-center bg-marketing-bg-elevated'>
                <span className='text-[0.8rem] font-medium uppercase tracking-wide text-marketing-text-muted-2'>
                  placeholder
                </span>
              </div>
            </div>
          </div>

          <div>
            <h2 className='text-[2rem] font-bold tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'>
              Feature <span className='text-marketing-amber-2'>Showcase</span>
            </h2>
            <p className='mt-3 max-w-[26rem] text-[1.375rem] leading-[1.7] text-marketing-muted'>
              Everything you need to design, validate, and deploy cloud architectures.
            </p>

            <ul className='mt-9 grid gap-x-6 gap-y-5 sm:grid-cols-2'>
              {features.map((feature) => (
                <li key={feature.title} className='flex gap-3'>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${feature.accentBgClass} ${feature.accentTextClass}`}>
                    <feature.icon size={16} strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className='text-[1rem] font-bold text-marketing-text-primary'>{feature.title}</h3>
                    <p className='mt-1 text-[0.85rem] leading-[1.55] text-marketing-text-secondary'>{feature.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
