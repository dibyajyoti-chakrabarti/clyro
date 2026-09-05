import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Check, Zap } from 'lucide-react'
import builtForEngineersIllustration from '../../../assets/landing_page/everything_needed_ill.webp'

const checklist = [
  'AI-generated architecture diagrams',
  'Automatic AWS provisioning',
  'Cost, performance & security insights',
  'Real-time monitoring & alerts',
  'Built-in best practices',
]

export default function BuiltForEngineers() {
  const badgeRef = useRef(null)
  const headingRef = useRef(null)
  const checklistRef = useRef(null)

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.registerPlugin(ScrollTrigger)

    // Single shared trigger (the checklist container) drives one timeline so the badge/H2
    // lead in and the checklist tick-in read as one continuous "arrival" sequence rather
    // than two independently-timed reveals.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: checklistRef.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      },
    })

    tl.from([badgeRef.current, headingRef.current], {
      y: 16,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
    })

    const icons = checklistRef.current.querySelectorAll('.checklist-icon')
    const labels = checklistRef.current.querySelectorAll('.checklist-label')

    tl.from(
      icons,
      {
        scale: 0,
        duration: 0.4,
        ease: 'back.out(1.7)',
        stagger: 0.15,
      },
      '-=0.15',
    )
    tl.from(
      labels,
      {
        opacity: 0,
        x: -8,
        duration: 0.4,
        stagger: 0.15,
      },
      '<',
    )
  })

  return (
    <section id='company' className='bg-[#0C0E17] px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
      <div className='mx-auto grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-2 lg:gap-14'>
        <div>
          <span
            ref={badgeRef}
            className='inline-flex items-center gap-2 rounded-full border-2 border-black bg-marketing-bronze px-4 py-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-marketing-cream-2'
            style={{ transform: 'rotate(-2deg)' }}
          >
            <Zap size={13} strokeWidth={2} />
            Built for Developers
          </span>

          <h2
            ref={headingRef}
            className='mt-5 text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'
          >
            Everything you need to <span className='text-marketing-amber-2'>build and run</span> in the
            cloud.
          </h2>

          <ul ref={checklistRef} className='mt-8 flex flex-col gap-3.5'>
            {checklist.map((item) => (
              <li key={item} className='checklist-item flex items-center gap-3'>
                <span className='checklist-icon flex size-6 shrink-0 items-center justify-center rounded-full bg-marketing-amber-core'>
                  <Check size={14} strokeWidth={3} className='text-black' />
                </span>
                <span className='checklist-label text-[1rem] text-marketing-ink'>{item}</span>
              </li>
            ))}
          </ul>

          <a
            href='#features'
            className='mt-9 inline-flex h-[48px] items-center justify-center gap-2 rounded-xl border border-marketing-border-hairline bg-white/[0.02] px-6 text-[0.9rem] font-semibold text-marketing-ink transition-colors hover:border-white/35 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber-2'
          >
            Explore All Features
            <span aria-hidden='true'>→</span>
          </a>
        </div>

        <div>
          <div className='aspect-[3/2] w-full'>
            <img
              src={builtForEngineersIllustration}
              alt='Illustration of a Clyro storefront offering infrastructure essentials, operations and monitoring, and optimization and best practices to engineers'
              className='h-full w-full object-cover'
            />
          </div>
        </div>
      </div>
    </section>
  )
}
