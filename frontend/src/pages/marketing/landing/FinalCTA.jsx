import { Link } from 'react-router-dom'

export default function FinalCTA() {
  return (
    <section className='bg-marketing-amber-2 px-5 py-14 sm:px-6 lg:px-8 lg:py-16'>
      <div className='mx-auto flex w-full max-w-[1240px] flex-col items-center text-center'>
        <h2 className='mb-3 max-w-[44rem] text-[2rem] font-bold leading-[1.1] tracking-tight text-marketing-bg-deep lg:text-[2.75rem]'>
          Ready to move from idea to cloud?
        </h2>
        <p className='mb-5 max-w-[32rem] text-[1.375rem] leading-[1.6] text-marketing-bg-deep/80'>
          Start building your infrastructure now. No credit card required.
        </p>

        <div className='mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center'>
          <Link
            to='/signup'
            className='inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-marketing-amber-2 bg-marketing-bg-deep px-6 text-[1rem] font-semibold text-marketing-amber-2 shadow-[0_10px_28px_rgba(11,11,11,0.18)] transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-bg-deep'
          >
            Start Building Free
            <span aria-hidden='true'>→</span>
          </Link>
          <Link
            to='/pricing'
            className='inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-marketing-bg-deep/40 bg-transparent px-6 text-[1rem] font-semibold text-marketing-bg-deep transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-bg-deep'
          >
            View Plans
          </Link>
        </div>

        <p className='text-[0.85rem] font-medium text-marketing-bg-deep/70'>
          Free 14-day trial &bull; No credit card &bull; Cancel anytime
        </p>
      </div>
    </section>
  )
}
