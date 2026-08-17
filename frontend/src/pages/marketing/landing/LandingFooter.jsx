import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import clyroLogo from '../../../assets/logos/Clyro_logo.png'
import githubLogo from '../../../assets/logos/github-fill.svg'
import linkedinLogo from '../../../assets/logos/linkedin-box-fill.svg'
import twitterLogo from '../../../assets/logos/twitter-fill.svg'

// Shared sizing/typography for both stacked wordmark layers — kept identical so the
// outline and gold-fill copies overlay pixel-for-pixel. Font size is applied inline
// (computed at runtime, see useWordmarkFitWidth below) rather than via a vw/clamp
// class, since neither guarantees an exact rendered width.
const WORDMARK_TEXT_CLASS =
  'pointer-events-none col-start-1 row-start-1 inline-block select-none whitespace-nowrap text-center font-black leading-none tracking-tight'

// Starting font-size used for the first paint, before the fit-to-width measurement
// corrects it — picked close to the typical final desktop size to minimize the flash.
const WORDMARK_BASELINE_FONT_SIZE = 160

// Reveal-circle radii for the cursor-follow gold mask: inner edge is fully opaque gold,
// outer edge fades to transparent, tuned so the circle feels proportional to the wordmark
// (roughly a third of the glyph height) rather than a pinprick or a full-word flood.
const MASK_IMAGE =
  'radial-gradient(circle at var(--mx, -9999px) var(--my, -9999px), black 0px, black 90px, transparent 170px)'

// Touch devices (no persistent hover position) and prefers-reduced-motion both skip the
// interactive gold-fill layer entirely — not just visually masked away, but never mounted,
// so no pointermove listeners or quickTo tweens are ever created for them.
function supportsWordmarkFollow() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/* Landing-only footer. components/layout/Footer stays untouched for /pricing and the
   auth pages that share PublicLayout. */

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'How It Works', href: '#how-it-works' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Documentation', href: '#docs' },
      { label: 'Blog', href: '#blog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '#about' },
      { label: 'Contact', href: '#contact' },
      { label: 'Privacy Policy', href: '#privacy' },
      { label: 'Terms of Service', href: '#terms' },
    ],
  },
]

const socials = [
  { label: 'Twitter', logo: twitterLogo },
  { label: 'LinkedIn', logo: linkedinLogo },
  { label: 'GitHub', logo: githubLogo },
]

// Measures the wordmark's natural rendered width against its 90%-width container and
// scales the font-size so it fits exactly, rather than approximating via vw units.
// Recomputes on mount, once fonts finish loading, and on debounced window resize.
function useWordmarkFitWidth(containerRef, textRef) {
  const [fontSize, setFontSize] = useState(WORDMARK_BASELINE_FONT_SIZE)

  useEffect(() => {
    const recompute = () => {
      const container = containerRef.current
      const text = textRef.current
      if (!container || !text) return

      const containerWidth = container.getBoundingClientRect().width
      const textWidth = text.getBoundingClientRect().width
      if (!containerWidth || !textWidth) return

      const currentFontSize = parseFloat(window.getComputedStyle(text).fontSize)
      if (!currentFontSize) return

      setFontSize((containerWidth / textWidth) * currentFontSize)
    }

    recompute()

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(recompute).catch(() => {})
    }

    let resizeTimer
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(recompute, 150)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [containerRef, textRef])

  return fontSize
}

export default function LandingFooter() {
  const wordmarkRef = useRef(null)
  const wordmarkContainerRef = useRef(null)
  const wordmarkTextRef = useRef(null)
  const wordmarkMaskRef = useRef(null)
  const [canFollow] = useState(supportsWordmarkFollow)
  const wordmarkFontSize = useWordmarkFitWidth(wordmarkContainerRef, wordmarkTextRef)

  useGSAP(
    () => {
      const el = wordmarkRef.current
      if (!el || !canFollow) return

      el.style.setProperty('--mx', '-9999px')
      el.style.setProperty('--my', '-9999px')

      const xTo = gsap.quickTo(el, '--mx', { duration: 0.3, ease: 'power3', unit: 'px' })
      const yTo = gsap.quickTo(el, '--my', { duration: 0.3, ease: 'power3', unit: 'px' })

      const handleMove = (event) => {
        // Mask coordinates are relative to the gold-fill span itself (the element the
        // mask-image is applied to), which is narrower than `el` now that the wordmark
        // is centered at its fit-to-width font-size rather than stretched full-width.
        const rect = (wordmarkMaskRef.current ?? el).getBoundingClientRect()
        xTo(event.clientX - rect.left)
        yTo(event.clientY - rect.top)
      }

      // Send the reveal circle far outside the text box (rather than to 0 radius) so it
      // fades away by simply drifting off-frame, reusing the same quickTo tweens.
      const handleLeave = () => {
        xTo(-9999)
        yTo(-9999)
      }

      el.addEventListener('pointermove', handleMove)
      el.addEventListener('pointerleave', handleLeave)

      return () => {
        el.removeEventListener('pointermove', handleMove)
        el.removeEventListener('pointerleave', handleLeave)
      }
    },
    { scope: wordmarkRef },
  )

  return (
    <footer className='bg-marketing-bg-deep px-5 py-12 sm:px-6 lg:px-8 lg:py-16'>
      <div className='mx-auto w-full max-w-[1240px]'>
        <div ref={wordmarkContainerRef} className='mx-auto mb-10 w-[90%] lg:mb-14'>
          <div
            ref={wordmarkRef}
            aria-hidden='true'
            className='relative grid w-full justify-items-center overflow-hidden'
          >
            <span
              ref={wordmarkTextRef}
              className={`${WORDMARK_TEXT_CLASS} text-transparent [-webkit-text-stroke:1.5px_var(--color-marketing-warm-gray)]`}
              style={{ fontSize: `${wordmarkFontSize}px` }}
            >
              CLYRO
            </span>
            {canFollow ? (
              <span
                ref={wordmarkMaskRef}
                className={`${WORDMARK_TEXT_CLASS} text-marketing-gold-light`}
                style={{ fontSize: `${wordmarkFontSize}px`, maskImage: MASK_IMAGE, WebkitMaskImage: MASK_IMAGE }}
              >
                CLYRO
              </span>
            ) : null}
          </div>
        </div>

        <div className='grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))]'>
          <div>
            <div className='inline-flex items-center gap-2.5'>
              <img src={clyroLogo} alt='Clyro' className='h-8 w-auto shrink-0' />
              <span className='text-[1.25rem] font-bold text-marketing-text-primary'>Clyro</span>
            </div>
            <p className='mt-5 max-w-[19rem] text-[0.85rem] leading-[1.6] text-marketing-text-secondary'>
              AI-powered cloud infrastructure platform that helps engineers build,
              deploy, and optimize on AWS.
            </p>
          </div>

          {columns.map((column, index) => (
            <div
              key={column.heading}
              className={`lg:pl-8 ${index === 0 ? 'lg:border-l lg:border-marketing-border-hairline' : ''}`}
            >
              <h3 className='text-[1rem] font-semibold text-marketing-text-primary'>{column.heading}</h3>
              <ul className='mt-4 space-y-2.5'>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className='text-[0.85rem] text-marketing-text-muted-2 transition-colors hover:text-marketing-gold-light'
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className='mt-10 flex flex-col items-center gap-6 border-t border-marketing-border-hairline pt-7 sm:flex-row sm:justify-between'>
          <p className='text-[0.75rem] text-marketing-text-muted-2/70'>© 2026 Clyro. All rights reserved.</p>

          <ul className='flex items-center gap-3' aria-label='Social links'>
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href='/'
                  aria-label={social.label}
                  className='flex size-10 items-center justify-center rounded-full border border-marketing-border-hairline text-marketing-text-muted-2 transition-colors hover:border-marketing-gold-light hover:text-marketing-gold-light'
                >
                  <img
                    src={social.logo}
                    alt=''
                    aria-hidden='true'
                    className='h-[20px] w-[20px] opacity-90 invert transition-opacity hover:opacity-100'
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
