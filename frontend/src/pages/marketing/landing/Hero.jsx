import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'

export default function Hero() {
  return (
    <section className='overflow-hidden border-b border-white/[0.08] bg-background text-text-primary'>
      <div className='mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:px-8 lg:py-24'>
        <div className='max-w-2xl'>
          <div className='inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-normal text-amber-300 shadow-[0_0_32px_rgba(251,191,36,0.08)]'>
            <span className='size-2 rounded-full bg-amber-300' aria-hidden='true' />
            AI-native cloud platform
          </div>

          <div className='mt-8 space-y-5'>
            <h1 className='max-w-3xl text-4xl font-bold leading-tight tracking-normal text-text-primary sm:text-5xl lg:text-6xl'>
              Design Cloud Infrastructure Visually. Deploy Instantly.
            </h1>
            <p className='max-w-xl text-base leading-7 text-text-muted sm:text-lg'>
              Build, validate, and deploy production-ready AWS architectures from a single intelligent canvas.
            </p>
          </div>

          <div className='mt-9 flex flex-col gap-3 sm:flex-row'>
            <Link to='/signup' className='sm:w-auto'>
              <Button size='lg' className='w-full sm:w-auto'>
                Start Building
              </Button>
            </Link>
            <Link to='/pricing' className='sm:w-auto'>
              <Button variant='secondary' size='lg' className='w-full sm:w-auto'>
                See Pricing
              </Button>
            </Link>
          </div>
        </div>

        <div className='rounded-lg border border-white/[0.12] bg-surface/70 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.32)]'>
          <div className='flex min-h-[280px] items-center justify-center rounded-md border border-white/[0.08] bg-background/70 sm:min-h-[360px] lg:min-h-[460px]'>
            <div className='max-w-xs px-6 text-center'>
              <p className='text-sm font-semibold text-text-primary'>Architecture Preview</p>
              <p className='mt-2 text-sm leading-6 text-text-muted'>
                Placeholder panel for the visual deployment canvas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
