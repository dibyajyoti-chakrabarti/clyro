import { DollarSign, Sparkles, Cloud, ShieldCheck } from 'lucide-react'
import Card from '../../../components/ui/Card'

const features = [
  {
    title: 'Real-time Cost Estimation',
    icon: DollarSign,
    description: 'See accurate pricing as you build and optimize before you deploy.',
  },
  {
    title: 'AI Architecture Assistant',
    icon: Sparkles,
    description: 'Get intelligent suggestions for better, secure, and scalable designs.',
  },
  {
    title: 'Instant AWS Provisioning',
    icon: Cloud,
    description: 'Go from diagram to deployed infrastructure in minutes, not hours.',
  },
  {
    title: 'Deployment Readiness',
    icon: ShieldCheck,
    description: 'Validate best practices, security, and high availability automatically.',
  },
]

export default function WhyCrylo() {
  return (
    <section className='w-full bg-background text-text-primary'>
      <div className='mx-auto w-full max-w-[1700px] px-4 sm:px-6 lg:px-10 xl:px-12'>
        <h2 className='text-center text-3xl font-semibold tracking-normal sm:text-4xl'>
          Why Clyro?
        </h2>

        <div className='mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <Card key={feature.title} className='border-white/[0.09] bg-surface/45 p-5'>
                <div className='flex size-10 items-center justify-center rounded-full border border-amber-300/25 bg-amber-400/[0.06] text-lg font-semibold text-amber-300'>
                  <Icon className='h-10 w-10 text-amber-300' />
                </div>
                <h3 className='mt-4 text-base font-semibold text-text-primary'>{feature.title}</h3>
                <p className='mt-2 text-sm leading-6 text-text-muted'>
                  {feature.description}
                </p>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
