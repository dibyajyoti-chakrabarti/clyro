import {
  BadgeCheck,
  BellRing,
  Bot,
  Calculator,
  Rocket,
  Workflow,
} from 'lucide-react'
import showcaseIll from '../../../assets/landing_page/feature_showcase_ill.webp'

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
    <section id='features' className='bg-[#FDF6ED] px-5 pb-20 sm:px-6 lg:px-8 lg:pb-28'>
      <div className='mx-auto grid w-full max-w-[1240px] items-center gap-10 rounded-2xl bg-[#0F1F1B] px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-14 lg:px-12 lg:py-16'>
        <div>
          <img
            src={showcaseIll}
            alt='Clyro architecture editor with an interactive AWS diagram, cost estimation and confidence score panels'
            className='w-full max-w-full'
            width={1536}
            height={1024}
          />
        </div>

        <div>
          <h2 className='text-[1.9rem] font-bold tracking-[-0.02em] text-white sm:text-[2.35rem]'>
            Feature <span className='text-[#E8A33D]'>Showcase</span>
          </h2>
          <p className='mt-3 max-w-[26rem] text-[0.92rem] leading-[1.7] text-white/60'>
            Everything you need to design, validate, and deploy cloud architectures.
          </p>

          <ul className='mt-9 grid gap-x-7 gap-y-7 sm:grid-cols-2'>
            {features.map((feature) => (
              <li key={feature.title} className='flex gap-3.5'>
                <span className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#E8A33D]'>
                  <feature.icon size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className='text-[0.92rem] font-bold text-white'>{feature.title}</h3>
                  <p className='mt-1 text-[0.8rem] leading-[1.55] text-white/55'>{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
