import { Link } from 'react-router-dom'
import { Check, Zap, PlayCircle, BarChart, Shield, Sparkles } from 'lucide-react'

const assurances = ['No credit card required', 'AI-Powered', 'Supports AWS']

const calloutBadges = [
  {
    label: 'Scalable',
    Icon: BarChart,
    wrapperClass: '-left-6 top-6',
    lineClass: 'left-[52%] top-full h-10 w-px',
  },
  {
    label: 'Secure',
    Icon: Shield,
    wrapperClass: '-right-6 top-6',
    lineClass: 'left-[48%] top-full h-10 w-px',
  },
  {
    label: 'Intelligent',
    Icon: Sparkles,
    wrapperClass: '-left-6 bottom-6',
    lineClass: 'left-[52%] bottom-full h-10 w-px',
  },
  {
    label: 'Optimized',
    Icon: Zap,
    wrapperClass: '-right-6 bottom-6',
    lineClass: 'left-[48%] bottom-full h-10 w-px',
  },
]

export default function HeroSection() {
  return (
    <section className='relative overflow-hidden bg-marketing-dark'>
      {/* Deep space backdrop: base gradient + scattered star dots + soft amber glow. */}
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#1c1830_0%,#0d0b16_55%,#0d0b16_100%)]' />
        <div
          className='absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(247,246,243,0.5)_1px,transparent_1px),radial-gradient(rgba(244,196,48,0.5)_1px,transparent_1px)] [background-size:140px_140px,220px_220px] [background-position:0_0,70px_90px]'
        />
        <div className='absolute -right-40 -top-32 h-[560px] w-[560px] rounded-full bg-marketing-amber/20 blur-[110px]' />
      </div>

      <div className='relative mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1.18fr)] lg:gap-6 lg:px-8 lg:py-24'>
        <div>
          <span className='inline-flex items-center gap-2 rounded-full border border-marketing-amber-border bg-marketing-amber-soft px-4 py-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-marketing-amber'>
            <Zap size={13} strokeWidth={2} />
            AI-Powered Cloud Infrastructure
          </span>

          <h1 className='mt-6 text-[2.75rem] font-bold leading-[1.1] tracking-[-0.035em] text-marketing-ink lg:text-[3.5rem]'>
            From Idea to Cloud Infrastructure,{' '}
            <span className='relative inline-block text-marketing-amber'>
              Powered by AI.
              <span
                className='absolute inset-x-0 -bottom-1.5 h-[3px] rounded-full bg-marketing-amber/50'
                aria-hidden='true'
              />
            </span>
          </h1>

          <p className='mt-6 max-w-[30rem] text-[1.375rem] leading-[1.75] text-marketing-muted'>
            Clyro designs, reviews and deploys production-ready cloud infrastructure in
            minutes — so you can ship faster.
          </p>

          <div className='mt-9 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Link
              to='/signup'
              className='inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-marketing-amber px-7 text-[0.95rem] font-semibold text-marketing-dark shadow-[0_10px_28px_rgba(244,196,48,0.22)] transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber'
            >
              Start Building for Free
              <span aria-hidden='true'>→</span>
            </Link>
            <Link
              to='/pricing'
              className='inline-flex h-[52px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-7 text-[0.95rem] font-semibold text-marketing-ink transition-colors hover:border-white/35 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber'
            >
              <PlayCircle size={17} strokeWidth={2} />
              Book a Demo
            </Link>
          </div>

          <ul className='mt-8 flex flex-wrap items-center gap-x-7 gap-y-3'>
            {assurances.map((item) => (
              <li key={item} className='flex items-center gap-2 text-[0.85rem] font-medium text-marketing-muted'>
                <span className='flex size-[18px] items-center justify-center rounded-full bg-marketing-amber'>
                  <Check size={11} strokeWidth={3.2} className='text-marketing-dark' />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className='relative mx-auto w-full max-w-[560px] lg:mx-0'>
          <div
            className='relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_30px_60px_rgba(0,0,0,0.45)]'
          >
            <div
              className='pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marketing-amber/15 blur-[70px]'
              aria-hidden='true'
            />
            <span className='relative text-[0.85rem] font-medium text-marketing-muted'>
              Illustration placeholder
            </span>
          </div>

          {calloutBadges.map(({ label, Icon, wrapperClass, lineClass }) => (
            <div key={label} className={`absolute z-10 hidden lg:block ${wrapperClass}`} aria-hidden='true'>
              <span
                className={`absolute border-l border-dashed border-marketing-amber-border ${lineClass}`}
              />
              <span className='relative inline-flex items-center gap-1.5 rounded-full border border-marketing-amber-border bg-marketing-dark-surface/90 px-3 py-1.5 text-[0.7rem] font-semibold text-marketing-ink shadow-[0_8px_20px_rgba(0,0,0,0.35)]'>
                <Icon size={13} strokeWidth={2} className='text-marketing-amber' />
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
