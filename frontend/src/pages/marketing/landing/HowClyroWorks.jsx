import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import step1Illustration from '../../../assets/landing_page/step1-ill.webp'
import step2Illustration from '../../../assets/landing_page/step2-ill.webp'
import step3Illustration from '../../../assets/landing_page/step3-ill.webp'
import step4Illustration from '../../../assets/landing_page/step4-ill.webp'
import step5Illustration from '../../../assets/landing_page/step5-ill.webp'

const steps = [
  {
    title: 'Describe Your Idea',
    body: 'Tell Clyro what you want to build in plain language.',
    illustration: step1Illustration,
  },
  {
    title: 'AI Designs Architecture',
    body: 'Clyro generates a secure, scalable architecture tailored to your needs.',
    illustration: step2Illustration,
  },
  {
    title: 'Review & Customize',
    body: 'Review the architecture, get AI recommendations, and customize if needed.',
    illustration: step3Illustration,
  },
  {
    title: 'One-Click Deploy',
    body: 'Clyro provisions all AWS resources automatically and securely.',
    illustration: step4Illustration,
  },
  {
    title: 'Monitor & Optimize',
    body: 'Monitor performance, costs, and security. Clyro keeps your infra optimized.',
    illustration: step5Illustration,
  },
]

function StepCard({ step, index, onImageLoad }) {
  return (
    <div className='relative flex h-full flex-1 flex-col rounded-2xl bg-marketing-cream-2 p-6 shadow-md'>
      <span className='absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-full bg-black text-[0.8rem] font-bold text-white'>
        {index + 1}
      </span>

      <div className='mx-auto flex h-48 w-full items-center justify-center overflow-hidden'>
        <img
          src={step.illustration}
          alt={`Illustration for step ${index + 1}: ${step.title}`}
          className='h-full w-full object-contain'
          onLoad={onImageLoad}
        />
      </div>

      <h3 className='mt-5 text-[1rem] font-bold text-marketing-near-black'>{step.title}</h3>
      <p className='mt-2 text-[0.85rem] leading-[1.6] text-[#6B665C]'>{step.body}</p>
    </div>
  )
}

export default function HowClyroWorks() {
  const sectionRef = useRef(null)
  const viewportRef = useRef(null)
  const trackRef = useRef(null)

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const refreshScrollTrigger = () => ScrollTrigger.refresh()

  useGSAP(() => {
    if (prefersReducedMotion) return

    gsap.registerPlugin(ScrollTrigger)

    const mm = gsap.matchMedia()

    mm.add('(min-width: 1024px)', () => {
      const track = trackRef.current
      const viewport = viewportRef.current
      if (!track || !viewport) return

      // Horizontal scroll distance is derived from the track's actual rendered width
      // (all 5 cards + gaps) minus the visible viewport width — recomputed on every
      // ScrollTrigger refresh (resize, or the manual refresh() after images load) via
      // invalidateOnRefresh, so nothing here is a hardcoded pixel value.
      const getScrollDistance = () => track.scrollWidth - viewport.clientWidth

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: () => '+=' + getScrollDistance(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      })

      tl.to(track, {
        x: () => -getScrollDistance(),
        ease: 'none',
      })

      // GSAP wraps the pinned section in an auto-generated "pin-spacer" div sized to the
      // full pin duration (natural height + scroll distance). That spacer is unstyled/
      // transparent, so while the pinned section (which only paints its own natural height)
      // is stuck at the top, the extra reserved space below it exposes the page's dark
      // --c-body background instead of the section's own gold-pale one. Match the spacer's
      // background to the section so nothing shows through.
      const spacer = tl.scrollTrigger.pin?.parentNode
      spacer?.classList.add('bg-marketing-gold-pale')
    })

    return () => mm.revert()
  })

  // prefers-reduced-motion fallback: skip the pin/horizontal-scroll mechanism entirely
  // and render the original static grid-cols-5 layout (desktop) / stacked layout (mobile).
  if (prefersReducedMotion) {
    return (
      <section
        id='how-it-works'
        className='relative -mt-10 bg-marketing-gold-pale px-5 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-14 lg:pt-24'
      >
        <div className='mx-auto w-full max-w-[1600px]'>
          <h2 className='text-center text-[2rem] font-bold tracking-tight text-marketing-bronze-dark lg:text-[2.75rem]'>
            How Clyro Works
          </h2>
          <p className='mx-auto mt-4 max-w-[36rem] text-center text-[1.375rem] leading-[1.6] text-marketing-bronze-dark/75'>
            Go from an idea to a fully provisioned cloud environment in minutes.
          </p>

          <ol className='mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3'>
            {steps.map((step, index) => (
              <li key={step.title} className='relative flex'>
                <StepCard step={step} index={index} />
              </li>
            ))}
          </ol>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={sectionRef}
      id='how-it-works'
      className='relative -mt-10 bg-marketing-gold-pale px-5 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-14 lg:pt-24'
    >
      {/* Defensive patch for a ~3-4px rendering seam at the very top of the viewport: the
          sticky navbar (z-index: 50) has no background of its own, so while this section is
          pinned at "top top" a sub-pixel gap between the navbar and the section's own
          background exposes the page's dark --c-body color underneath. This strip sits
          behind the section's content (negative z-index) and just extends the section's own
          background slightly above its top edge so nothing shows through, regardless of pin
          state. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 -top-2 -z-10 h-2 bg-marketing-gold-pale'
      />
      <div className='mx-auto w-full max-w-[1600px]'>
        <h2 className='text-center text-[2rem] font-bold tracking-tight text-marketing-bronze-dark lg:text-[2.75rem]'>
          How Clyro Works
        </h2>
        <p className='mx-auto mt-4 max-w-[36rem] text-center text-[1.375rem] leading-[1.6] text-marketing-bronze-dark/75'>
          Go from an idea to a fully provisioned cloud environment in minutes.
        </p>

        {/* Below lg: normal stacked/grid flow (viewport wrapper has no clipping, track is a
            grid). At lg and up: viewport clips to the section width and the track becomes a
            fixed-width flex row that GSAP translates on the X axis while the section is
            pinned — the "filmstrip" scroll-jack. lg:pt-3/lg:pl-3 give the clipping box enough
            top/left inset to contain each card's -top-2/-left-2 numbered badge — absolutely
            positioned elements aren't counted in the wrapper's auto-height/flow bounds, so
            without this padding the badges (and the card's top edge) get clipped by
            overflow-hidden. */}
        <div ref={viewportRef} className='mt-10 lg:overflow-hidden lg:pl-3 lg:pt-3'>
          <ol
            ref={trackRef}
            className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:flex lg:w-max lg:gap-3'
          >
            {steps.map((step, index) => (
              <li
                key={step.title}
                className='relative flex lg:w-[300px] lg:shrink-0 xl:w-[340px]'
              >
                <StepCard step={step} index={index} onImageLoad={refreshScrollTrigger} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
