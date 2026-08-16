import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import {
  BadgeCheck,
  BellRing,
  Bot,
  Calculator,
  Rocket,
  Workflow,
} from 'lucide-react'
import featureShowcaseIllustration from '../../../assets/landing_page/feature_showcase_ill.webp'

const features = [
  {
    icon: Bot,
    title: 'AI Guidance',
    body: 'Smart recommendations at every step.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: BadgeCheck,
    title: 'Best Practice Check',
    body: 'Built-in checks for security, reliability, and performance.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: Workflow,
    title: 'Visual Architecture',
    body: 'Interactive diagrams that are easy to edit.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: Rocket,
    title: 'One-Click Deployment',
    body: 'Deploy your entire stack with a single click.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: Calculator,
    title: 'Cost Estimation',
    body: 'Real-time cost estimates with breakdowns.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
  {
    icon: BellRing,
    title: 'Monitoring & Alerts',
    body: 'Monitor resources and get proactive alerts.',
    accentBgClass: 'bg-marketing-amber-core',
    accentTextClass: 'text-black',
  },
]

export default function FeatureShowcase() {
  const cardRef = useRef(null)
  const illustrationRef = useRef(null)
  const gridRef = useRef(null)

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.registerPlugin(ScrollTrigger)

    const mm = gsap.matchMedia()

    // Illustration parallax is desktop-only: below lg the illustration stacks above the
    // (now single-column) feature grid with limited vertical room, so even this modest
    // drift risks overlapping the heading/grid content right below it.
    mm.add('(min-width: 1024px)', () => {
      gsap.to(illustrationRef.current, {
        yPercent: -18,
        ease: 'none',
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })
    })

    gsap.from(gridRef.current.querySelectorAll('.feature-grid-item'), {
      y: 20,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: gridRef.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      },
    })

    return () => mm.revert()
  })

  return (
    <section id='features' className='bg-marketing-gold-pale px-5 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14'>
      <div ref={cardRef} className='mx-auto w-[99%] rounded-2xl bg-marketing-near-black p-6 lg:rounded-3xl lg:p-10'>
        <div className='grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12'>
          <div>
            <div className='aspect-[3/2] w-full'>
              <img
                ref={illustrationRef}
                src={featureShowcaseIllustration}
                alt='Clyro dashboard overview showing total resources, cost estimate, confidence score, monthly cost chart, and resource distribution'
                className='h-full w-full object-cover'
              />
            </div>
          </div>

          <div>
            <h2 className='text-[2rem] font-bold tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'>
              Feature <span className='text-marketing-amber-2'>Showcase</span>
            </h2>
            <p className='mt-3 max-w-[26rem] text-[1.375rem] leading-[1.7] text-marketing-muted'>
              Everything you need to design, validate, and deploy cloud architectures.
            </p>

            <ul ref={gridRef} className='mt-9 grid gap-x-6 gap-y-5 sm:grid-cols-2'>
              {features.map((feature) => (
                <li key={feature.title} className='feature-grid-item flex gap-3'>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${feature.accentBgClass} ${feature.accentTextClass}`}>
                    <feature.icon size={16} strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className='text-[1rem] font-bold text-marketing-text-primary'>{feature.title}</h3>
                    <p className='mt-1 text-[0.85rem] leading-[1.55] text-marketing-text-secondary'>{feature.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
