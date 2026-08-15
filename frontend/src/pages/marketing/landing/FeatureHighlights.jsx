import { Activity, Gauge, Rocket, Sparkles } from 'lucide-react'

const highlights = [
  {
    icon: Sparkles,
    title: 'AI-Powered Architecture',
    body: 'Describe your idea and Clyro generates a secure, scalable cloud architecture for you.',
  },
  {
    icon: Rocket,
    title: 'One-Click Provisioning',
    body: 'Provision all AWS resources automatically. No manual configuration, no complexity.',
  },
  {
    icon: Gauge,
    title: 'Review & Optimize',
    body: 'Get intelligent recommendations to improve cost, performance, and security.',
  },
  {
    icon: Activity,
    title: 'Monitor & Evolve',
    body: 'Continuously monitor and evolve your infrastructure with real-time insights.',
  },
]

export default function FeatureHighlights() {
  return (
    <section className='bg-marketing-dark px-5 pb-16 sm:px-6 lg:px-8'>
      <div className='mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4'>
        {highlights.map((item) => (
          <div
            key={item.title}
            className='flex flex-col rounded-2xl border border-white/10 bg-marketing-dark-surface p-6'
          >
            <span className='flex size-12 items-center justify-center rounded-full bg-marketing-amber-soft text-marketing-amber'>
              <item.icon size={20} strokeWidth={1.8} />
            </span>
            <h3 className='mt-5 text-[1rem] font-bold text-marketing-ink'>{item.title}</h3>
            <p className='mt-2 text-[0.85rem] leading-[1.6] text-marketing-muted'>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
