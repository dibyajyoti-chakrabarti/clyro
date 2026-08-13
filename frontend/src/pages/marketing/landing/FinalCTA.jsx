import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import ctaIll from '../../../assets/landing_page/cta_ill.webp'

const assurances = ['No credit card required', 'Cancel anytime']

export default function FinalCTA() {
  return (
    <section className='bg-[#FDF6ED] px-5 pb-16 sm:px-6 lg:px-8'>
      <div className='mx-auto grid w-full max-w-[1240px] items-center gap-10 overflow-hidden rounded-2xl bg-[#0F1F1B] px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-12 lg:py-14'>
        <div>
          <h2 className='text-[1.9rem] font-bold leading-[1.15] tracking-[-0.025em] text-white sm:text-[2.5rem]'>
            Ready to build better
            <br />
            on <span className='text-[#E8A33D]'>AWS</span>?
          </h2>

          <p className='mt-4 max-w-[24rem] text-[0.92rem] leading-[1.7] text-white/60'>
            Join thousands of engineering teams building faster with Clyro.
          </p>

          <div className='mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Link
              to='/signup'
              className='inline-flex h-[50px] items-center justify-center gap-2 rounded-xl bg-[#E8A33D] px-7 text-[0.92rem] font-semibold text-[#0B0B0B] transition-transform hover:-translate-y-0.5'
            >
              Get Started Free
              <span aria-hidden='true'>→</span>
            </Link>
            <Link
              to='/pricing'
              className='inline-flex h-[50px] items-center justify-center rounded-xl border border-white/25 px-7 text-[0.92rem] font-semibold text-white transition-colors hover:bg-white/[0.06]'
            >
              Book a Demo
            </Link>
          </div>

          <ul className='mt-7 flex flex-wrap items-center gap-x-7 gap-y-3'>
            {assurances.map((item) => (
              <li key={item} className='flex items-center gap-2 text-[0.78rem] font-medium text-white/60'>
                <span className='flex size-[17px] items-center justify-center rounded-full bg-[#E8A33D]'>
                  <Check size={10} strokeWidth={3.2} className='text-[#0F1F1B]' />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <img
            src={ctaIll}
            alt='Engineers watching a successful Clyro deployment complete on AWS'
            className='w-full max-w-full'
            width={1536}
            height={1024}
          />
        </div>
      </div>
    </section>
  )
}
