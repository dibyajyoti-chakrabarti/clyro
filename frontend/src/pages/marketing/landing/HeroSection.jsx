import { useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import heroIllustrationFirst from '../../../assets/landing_page/hero_section_ill_first.webp'
import heroIllustrationSecond from '../../../assets/landing_page/second_ill_hero_section.webp'
import painPointOne from '../../../assets/landing_page/one.webp'
import painPointTwo from '../../../assets/landing_page/two.webp'
import painPointThree from '../../../assets/landing_page/three.webp'
import {
  Activity,
  Calculator,
  PlayCircle,
  Rocket,
  Sparkles,
  TrendingUp,
  UploadCloud,
} from 'lucide-react'

const painPoints = [
  {
    image: painPointOne,
    alt: 'Illustration of a developer overwhelmed by a ticking clock, representing time spent designing AWS architecture',
    prefix: 'Spending too much time ',
    highlight: 'designing AWS architecture',
    suffix: '?',
  },
  {
    image: painPointTwo,
    alt: 'Illustration of a developer surrounded by manual AWS provisioning steps for networking, security, and compute',
    prefix: 'Still ',
    highlight: 'provisioning cloud infrastructure',
    suffix: ' manually?',
  },
  {
    image: painPointThree,
    alt: 'Illustration of a developer questioning whether their AWS infrastructure is secure, scalable, and cost-efficient',
    prefix: 'Not sure your infra is ',
    highlight: 'secure, scalable & cost-efficient',
    suffix: '?',
  },
]

const bottomFeatures = [
  { icon: Rocket, label: 'Architecture Generation' },
  { icon: UploadCloud, label: 'One-Click Provisioning' },
  { icon: Activity, label: 'Real-time Monitoring' },
  { icon: Sparkles, label: 'AI-Powered Reviews' },
  { icon: Calculator, label: 'Cost Estimation' },
  { icon: TrendingUp, label: 'Continuous Optimization' },
]

export default function HeroSection() {
  const heroTextRef = useRef(null)
  const amberGlowRef = useRef(null)
  const bronzeGlowRef = useRef(null)
  const painPointsRef = useRef(null)
  const solutionBlockRef = useRef(null)

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.registerPlugin(ScrollTrigger)

    const mm = gsap.matchMedia()

    mm.add('(min-width: 1024px)', () => {
      const scrollTriggerBase = {
        trigger: heroTextRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      }

      gsap.to(heroTextRef.current, {
        yPercent: -25,
        opacity: 0,
        ease: 'none',
        scrollTrigger: scrollTriggerBase,
      })

      gsap.to([amberGlowRef.current, bronzeGlowRef.current], {
        yPercent: -45,
        ease: 'none',
        scrollTrigger: { ...scrollTriggerBase },
      })

      // end: '+=800' is a placeholder pin distance — tune by eye once this is live.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: solutionBlockRef.current,
          start: 'top top',
          end: '+=800',
          pin: true,
          scrub: 1,
        },
      })

      tl.from(solutionBlockRef.current.querySelectorAll('.solution-icon-item'), {
        opacity: 0,
        y: 30,
        stagger: 0.15,
        ease: 'power1.out',
      })
    })

    gsap.from(painPointsRef.current.querySelectorAll('.pain-point-card'), {
      y: 24,
      opacity: 0,
      scale: 0.96,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: painPointsRef.current,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    })

    return () => mm.revert()
  })

  return (
    <section className='relative z-10 overflow-hidden rounded-b-[2.5rem] bg-marketing-bg-warm'>
      {/* Deep space backdrop: base gradient + scattered star dots + amber glow (top-right) + bronze glow (bottom-left).
          Single atmosphere layer shared by both Hero's own content and the merged
          pain-points/solution/feature-card content below — do not duplicate this per block. */}
      <div className='pointer-events-none absolute inset-0' aria-hidden='true'>
        <div className='absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#1c1830_0%,#0d0b16_55%,#0d0b16_100%)]' />
        <div
          className='absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(247,246,243,0.5)_1px,transparent_1px),radial-gradient(rgba(244,196,48,0.5)_1px,transparent_1px)] [background-size:140px_140px,220px_220px] [background-position:0_0,70px_90px]'
        />
        <div
          ref={amberGlowRef}
          className='absolute -right-40 -top-32 h-[560px] w-[560px] rounded-full bg-marketing-amber-core/[0.1] blur-[110px]'
        />
        <div
          ref={bronzeGlowRef}
          className='absolute -bottom-32 -left-40 h-[560px] w-[560px] rounded-full bg-marketing-bronze/[0.1] blur-[110px]'
        />
      </div>

      <div className='relative mx-auto grid w-full max-w-[1600px] items-center gap-12 px-6 pb-20 pt-36 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-2 lg:px-10 lg:pb-28 lg:pt-44'>
        <div ref={heroTextRef}>
          <h1 className='text-[2.75rem] font-bold leading-[1.1] tracking-[-0.035em] text-marketing-ink'>
            From Idea to Cloud Infrastructure,{' '}
            <span className='relative inline-block bg-gradient-to-r from-marketing-amber-2 to-marketing-amber-light bg-clip-text text-transparent'>
              Powered by AI.
              <span
                className='absolute inset-x-0 -bottom-1.5 h-[3px] rounded-full bg-gradient-to-r from-marketing-amber-2 to-marketing-amber-light opacity-50'
                aria-hidden='true'
              />
            </span>
          </h1>

          <p className='mt-6 max-w-[30rem] text-[1.375rem] leading-[1.75] text-marketing-muted lg:mt-7'>
            Clyro designs, reviews and deploys production-ready cloud infrastructure in
            minutes — so you can ship faster.
          </p>

          <div className='mt-9 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Link
              to='/signup'
              className='inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-marketing-amber px-7 text-[0.95rem] font-semibold text-marketing-dark shadow-[0_10px_28px_rgba(244,196,48,0.22)] transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber lg:h-14 lg:px-8'
            >
              Start Building for Free
              <span aria-hidden='true'>→</span>
            </Link>
            <Link
              to='/pricing'
              className='inline-flex h-[52px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-7 text-[0.95rem] font-semibold text-marketing-ink transition-colors hover:border-white/35 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-amber lg:h-14 lg:px-8'
            >
              <PlayCircle size={17} strokeWidth={2} />
              View Plans
            </Link>
          </div>
        </div>

        <div className='relative mx-auto w-full max-w-[760px] lg:mx-0'>
          <div className='relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden'>
            <div
              className='pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marketing-amber-2/15 blur-[70px]'
              aria-hidden='true'
            />
            <img
              src={heroIllustrationFirst}
              alt='Clyro dashboard showing an AI-generated AWS architecture diagram with cost estimate, confidence score, and resource count'
              className='relative h-full w-full object-cover'
            />
          </div>
        </div>
      </div>

      <div className='relative mx-auto w-full max-w-[1240px] px-5 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-24 lg:pt-8'>
        {/* Part 1 — pain points */}
        <h3 className='mx-auto max-w-[36rem] text-center text-[1.7rem] font-semibold leading-[1.25] text-marketing-text-primary'>
          Is your cloud infrastructure becoming{' '}
          <span className='text-marketing-amber-core'>harder to build, manage, and scale?</span>
        </h3>

        <ul ref={painPointsRef} className='mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8'>
          {painPoints.map((item) => (
            <li
              key={item.highlight}
              className='pain-point-card flex flex-col items-center gap-5 text-center sm:px-6'
            >
              <img
                src={item.image}
                alt={item.alt}
                className='size-24 shrink-0 object-contain sm:size-32'
              />
              <p className='text-[1rem] leading-[1.6] text-marketing-text-secondary'>
                {item.prefix}
                <span className='text-marketing-amber-core'>{item.highlight}</span>
                {item.suffix}
              </p>
            </li>
          ))}
        </ul>

        {/* Part 2 — solution heading + feature list (left) and a single contained illustration (right) */}
        <div
          ref={solutionBlockRef}
          className='mt-24 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-stretch lg:gap-12'
        >
          <div>
            <h2 className='text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] text-marketing-text-primary lg:text-[2.75rem]'>
              We build <span className='text-marketing-amber-core'>and evolve</span>
              <br />
              your cloud infrastructure
            </h2>
            <p className='mt-4 max-w-[32rem] text-[1.375rem] leading-[1.6] text-marketing-text-secondary'>
              From architecture to production — Clyro{' '}
              <span className='font-semibold text-marketing-amber-core'>handles the complexity</span>{' '}
              behind your AWS infrastructure.
            </p>

            <div className='mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3'>
              {bottomFeatures.map((item) => (
                <div
                  key={item.label}
                  className='solution-icon-item flex flex-col items-center gap-4 text-center'
                >
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-marketing-amber-core text-black'>
                    <item.icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className='text-[0.85rem] font-medium text-marketing-text-primary'>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='flex h-full min-h-[380px] w-full items-center justify-center overflow-hidden'>
            <img
              src={heroIllustrationSecond}
              alt='Two people holding balloons labeled with Clyro features: architecture generation, one-click provisioning, real-time monitoring, AI-powered reviews, cost estimation, and continuous optimization'
              className='h-full w-full object-contain'
              onLoad={() => ScrollTrigger.refresh()}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
