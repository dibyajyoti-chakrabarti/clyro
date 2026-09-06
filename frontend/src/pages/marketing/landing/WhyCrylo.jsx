import { useState } from 'react'
import { Receipt, Rocket, BotMessageSquare, ShieldCheck } from 'lucide-react'
import styles from './WhyCrylo.module.css'
import './WhyCrylo-global.css'

// Dot particles for shatter effect — used by all cards
const DOTS_160 = [
  { cx: 40,  cy: 38,  r: 3,   delay: '0s',    dx: '-18px', dy: '-14px' },
  { cx: 120, cy: 32,  r: 2.5, delay: '0.06s', dx:  '16px', dy: '-18px' },
  { cx: 138, cy: 80,  r: 3,   delay: '0.03s', dx:  '20px', dy:   '8px' },
  { cx: 22,  cy: 95,  r: 2,   delay: '0.09s', dx: '-22px', dy:  '12px' },
  { cx: 80,  cy: 18,  r: 2.8, delay: '0.04s', dx:   '4px', dy: '-24px' },
  { cx: 145, cy: 115, r: 2.2, delay: '0.07s', dx:  '18px', dy:  '16px' },
  { cx: 18,  cy: 55,  r: 2.5, delay: '0.05s', dx: '-20px', dy:  '-8px' },
  { cx: 95,  cy: 145, r: 2,   delay: '0.08s', dx:  '10px', dy:  '20px' },
  { cx: 55,  cy: 128, r: 3,   delay: '0.02s', dx: '-12px', dy:  '18px' },
  { cx: 110, cy: 55,  r: 1.8, delay: '0.1s',  dx:  '14px', dy: '-12px' },
]

function DotParticles() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" style={{ position: 'absolute' }}>
      {DOTS_160.map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill="#C9A84C"
          style={{ '--dx': dot.dx, '--dy': dot.dy, animationDelay: dot.delay }}
        />
      ))}
    </svg>
  )
}

const features = [
  {
    title: 'Real-time Cost Estimation',
    description: 'See accurate AWS pricing as you design: compute, storage, and networking costs update instantly. No bill surprises. Every resource is priced before a single dollar is spent.',
    icon: <Receipt size={160} strokeWidth={1.2} color="#C9A84C" />,
  },
  {
    title: 'AI Architecture Assistant',
    description: 'Get intelligent suggestions for better, secure, and scalable designs. Our AI reviews your architecture against AWS best practices and recommends improvements across reliability and cost efficiency.',
    icon: <BotMessageSquare size={160} strokeWidth={1.2} color="#C9A84C" />,
  },
  {
    title: 'Instant AWS Provisioning',
    description: 'Go from diagram to deployed infrastructure in minutes. Clyro auto-generates production-ready Terraform with no manual scripting and no CLI. Your full stack goes live with one click.',
    icon: <Rocket size={160} strokeWidth={1.2} color="#C9A84C" />,
  },
  {
    title: 'Deployment Readiness',
    description: 'Validate security and high availability before you deploy. Clyro runs pre-flight checks, catching misconfigurations, open security groups, and single points of failure automatically.',
    icon: <ShieldCheck size={160} strokeWidth={1.2} color="#C9A84C" />,
  },
]

export default function WhyCrylo() {
  const [activeCard, setActiveCard] = useState(null)
  const [expandingCards, setExpandingCards] = useState({})

  const toggleCard = (index) => {
    if (activeCard !== index) {
      // Opening — trigger sparkle pulse
      setExpandingCards(prev => ({ ...prev, [index]: true }))
      setTimeout(() => {
        setExpandingCards(prev => ({ ...prev, [index]: false }))
      }, 350)
    }
    setActiveCard(prev => prev === index ? null : index)
  }

  return (
    <section className={styles.whyClyroSection}>
      <h2 style={{
        fontSize: 'clamp(2.5rem, 5vw, 4rem)',
        fontWeight: '800',
        letterSpacing: '-0.03em',
        background: 'linear-gradient(135deg, #C9A84C 0%, #F5D78E 45%, #A87C2A 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textAlign: 'center',
        marginBottom: '16px',
      }}>
        Why Clyro?
      </h2>

      <p style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: '1.05rem',
        textAlign: 'center',
        marginBottom: '64px',
        fontWeight: '400',
      }}>
        Everything you need to design, estimate, and deploy cloud infrastructure.
      </p>

      <div className={styles.whyClyroGrid}>
        {features.map((feature, index) => {
          const isExpanded = activeCard === index
          const isExpanding = !!expandingCards[index]

          return (
            <div
              key={feature.title}
              className={`${styles.whyClyroCard} ${isExpanded ? styles.cardExpanded : ''}`}
              style={{ minHeight: '420px', height: '420px', position: 'relative' }}
            >
              {/* ── ICON AREA — fades out when expanded ── */}
              <div
                className={styles.iconWrapper}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 0 20px',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                  opacity: isExpanded ? 0 : 1,
                  transform: isExpanded ? 'translateY(-24px)' : 'translateY(0)',
                  pointerEvents: isExpanded ? 'none' : 'auto',
                }}
              >
                <div className={styles.iconSolid}>
                  {feature.icon}
                </div>
                <div className={styles.iconShatter}>
                  <DotParticles />
                </div>
              </div>

              {/* ── HEADING ROW (collapsed) — pinned to bottom ── */}
              {!isExpanded && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '16px',
                  position: 'relative',
                  zIndex: 2,
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    lineHeight: 1.3,
                    margin: 0,
                    flex: 1,
                  }}>
                    {feature.title}
                  </h3>

                  <button
                    className={`${styles.toggleBtn} ${isExpanding ? styles.expanding : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleCard(index) }}
                    aria-label="Expand"
                  >
                    +
                  </button>
                </div>
              )}

              {/* ── EXPANDED CONTENT — heading at top, description below, − at bottom ── */}
              {isExpanded && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  overflow: 'hidden',
                  zIndex: 2,
                  animation: 'fadeSlideIn 0.4s ease forwards',
                }}>
                  <h3 style={{
                    position: 'absolute',
                    top: '36px',
                    left: '36px',
                    right: '36px',
                    fontSize: '1.6rem',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    lineHeight: 1.25,
                    margin: 0,
                  }}>
                    {feature.title}
                  </h3>

                  <div style={{
                    position: 'absolute',
                    top: '120px',
                    left: '36px',
                    right: '36px',
                    bottom: '36px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                  }}>
                    <p style={{
                      fontSize: '1.05rem',
                      lineHeight: 1.8,
                      color: 'rgba(255,255,255,0.7)',
                      margin: 0,
                      fontWeight: '400',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 7,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {feature.description}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', flexShrink: 0 }}>
                      <button
                        className={styles.toggleBtn}
                        onClick={(e) => { e.stopPropagation(); toggleCard(index) }}
                        aria-label="Collapse"
                        style={{
                          backgroundColor: 'rgba(201,168,76,0.15)',
                          borderColor: 'rgba(201,168,76,0.5)',
                          color: '#C9A84C',
                        }}
                      >
                        −
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
