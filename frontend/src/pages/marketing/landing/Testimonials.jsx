import { Building2, Layers3, Cloud } from 'lucide-react'
import Card from '../../../components/ui/Card'

const companies = [
  {
    name: 'Acme Corp',
    icon: Building2,
  },
  {
    name: 'ByteScale',
    icon: Layers3,
  },
  {
    name: 'CloudWave',
    icon: Cloud,
  },
]

export default function Testimonials() {
  return (
    <section className='w-full bg-background text-text-primary'>
      <div className='mx-auto grid w-full max-w-[1700px] gap-3 px-4 sm:px-6 lg:grid-cols-[0.85fr_2fr_0.85fr] lg:px-10 xl:px-12'>
        <Card className='border-white/[0.07] bg-surface/35 p-3'>
          <h2 className='text-sm font-semibold text-text-primary'>Loved by Builders</h2>
          <p className='mt-2 text-2xl font-bold tracking-normal text-amber-300'>10K+</p>
          <p className='mt-1 max-w-[11rem] text-xs leading-4 text-text-muted'>
            Architectures deployed on AWS via Clyro
          </p>
        </Card>

        <Card className='border-white/[0.07] bg-surface/35 p-3 sm:p-4'>
          <div className='flex h-full flex-col justify-between gap-3 sm:flex-row sm:items-end'>
            <div>
              <p className='text-2xl font-semibold leading-none text-amber-300' aria-hidden='true'>
                "
              </p>
              <blockquote className='mt-1 max-w-xl text-xs leading-5 text-text-primary/85 sm:text-sm'>
                Clyro helped us go from idea to production in a single afternoon. The deployment experience is magical.
              </blockquote>
              <div className='mt-3 flex items-center gap-2.5'>
                <div className='flex size-8 items-center justify-center rounded-full border border-white/[0.09] bg-background/70 text-[11px] font-semibold text-text-primary'>
                  AA
                </div>
                <div>
                  <p className='text-xs font-semibold text-text-primary'>Anish Agrawal</p>
                  <p className='text-[11px] text-text-muted'>Founder, IndieShop</p>
                </div>
              </div>
            </div>

            <p className='text-sm font-semibold tracking-[0.12em] text-amber-300' aria-label='5 star rating'>
              *****
            </p>
          </div>
        </Card>

        <Card className='border-white/[0.07] bg-surface/35 p-3'>
          <ul className='space-y-3'>
            {companies.map((company) => {
              const Icon = company.icon

              return (
                <li key={company.name} className='flex items-center gap-2.5 text-xs font-medium text-text-primary/75 sm:text-sm'>
                  <Icon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                  {company.name}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </section>
  )
}
