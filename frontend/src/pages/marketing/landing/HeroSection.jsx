import { Link } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import heroIll from '../../../assets/landing_page/hero_section_ill.webp'

const assurances = ['No credit card required', 'Setup in 2 minutes', 'Cancel anytime']

export default function HeroSection() {
  return (
    <section className='relative overflow-hidden bg-[#FDF6ED]'>
      {/* Soft warm glow behind the illustration, matching the reference's tinted corner. */}
      <div
        className='pointer-events-none absolute -right-40 -top-32 h-[560px] w-[560px] rounded-full bg-[#F3D9AE]/45 blur-[90px]'
        aria-hidden='true'
      />

      <div className='relative mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1.18fr)] lg:gap-6 lg:px-8 lg:py-24'>
        <div>
          <span className='inline-flex items-center gap-2 rounded-full border border-[#E8A33D]/45 bg-[#FBEFD9] px-4 py-1.5 text-[0.72rem] font-semibold text-[#9A6A18]'>
            <Sparkles size={13} strokeWidth={2} />
            AI-Powered Cloud Architecture Platform
          </span>

          <h1 className='mt-6 text-[2.35rem] font-bold leading-[1.1] tracking-[-0.035em] text-[#0B0B0B] sm:text-[3rem] lg:text-[3.35rem] lg:whitespace-nowrap'>
            Design. Understand.
            <br />
            Deploy. <span className='text-[#E8A33D]'>With Confidence.</span>
          </h1>

          <p className='mt-6 max-w-[30rem] text-[1rem] leading-[1.75] text-[#5B574E]'>
            Clyro helps engineering teams design production-ready AWS architectures
            visually, get AI-powered reviews, and deploy in minutes.
          </p>

          <div className='mt-9 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Link
              to='/signup'
              className='inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-[#0B0B0B] px-7 text-[0.95rem] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5'
            >
              Get Started Free
              <span aria-hidden='true'>→</span>
            </Link>
            <Link
              to='/pricing'
              className='inline-flex h-[52px] items-center justify-center rounded-xl border border-black/15 bg-white px-7 text-[0.95rem] font-semibold text-[#0B0B0B] transition-colors hover:border-black/40'
            >
              Book a Demo
            </Link>
          </div>

          <ul className='mt-8 flex flex-wrap items-center gap-x-7 gap-y-3'>
            {assurances.map((item) => (
              <li key={item} className='flex items-center gap-2 text-[0.8rem] font-medium text-[#5B574E]'>
                <span className='flex size-[18px] items-center justify-center rounded-full bg-[#E8A33D]'>
                  <Check size={11} strokeWidth={3.2} className='text-white' />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className='relative'>
          <img
            src={heroIll}
            alt='Clyro Architecture workspace showing an AWS resource diagram alongside cost estimate, confidence score and resource count panels'
            className='w-full max-w-full'
            width={1536}
            height={1024}
          />
        </div>
      </div>
    </section>
  )
}
