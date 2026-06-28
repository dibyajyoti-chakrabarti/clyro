import { useRef, useState, useEffect } from 'react'
import { Rocket, Shield, Zap, Star } from 'lucide-react'

const miniStats = [
  { icon: <Rocket size={16} color="#C9A84C" strokeWidth={1.5} />, value: '98%',      label: 'Success Rate' },
  { icon: <Shield size={16} color="#C9A84C" strokeWidth={1.5} />, value: '50+',      label: 'Countries' },
  { icon: <Zap    size={16} color="#C9A84C" strokeWidth={1.5} />, value: '< 10 min', label: 'Avg. Deployment' },
  { icon: <Star   size={16} color="#C9A84C" strokeWidth={1.5} />, value: '4.9/5',    label: 'Builder Rating' },
]

const LaurelSvg = ({ flip }) => (
  <svg width="36" height="52" viewBox="0 0 36 52" fill="none" style={flip ? { transform: 'scaleX(-1)' } : {}}>
    <path d="M18 48 C18 48 4 38 4 24 C4 14 10 6 18 4" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.8"/>
    <path d="M18 40 C18 40 8 33 8 22" stroke="#C9A84C" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"/>
    <path d="M18 32 C14 30 10 26 10 20" stroke="#C9A84C" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"/>
    <ellipse cx="6" cy="18" rx="4" ry="6" transform="rotate(-20 6 18)" stroke="#C9A84C" strokeWidth="1" fill="none" opacity="0.5"/>
    <ellipse cx="10" cy="10" rx="3" ry="5" transform="rotate(-10 10 10)" stroke="#C9A84C" strokeWidth="1" fill="none" opacity="0.4"/>
    <ellipse cx="16" cy="6" rx="3" ry="4" stroke="#C9A84C" strokeWidth="1" fill="none" opacity="0.35"/>
  </svg>
)

const innerPanelStyle = {
  background: 'linear-gradient(145deg, rgba(240,230,200,0.92) 0%, rgba(232,210,160,0.88) 100%)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 -1px 0 rgba(201,168,76,0.1) inset, 0 8px 32px rgba(0,0,0,0.12)',
  padding: '40px 36px',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '360px',
}

export default function Testimonials() {
  const sectionRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.15 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const fadeUp = (delay) => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
  })

  return (
    <section
      ref={sectionRef}
      style={{
        background: 'linear-gradient(135deg, #040404 0%, #0D0A00 30%, #1A1200 55%, #0A0800 80%, #040404 100%)',
        backgroundSize: '300% 300%',
        animation: 'goldDrift 12s ease infinite',
        padding: '100px 48px 48px',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes goldDrift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (max-width: 768px) {
          .testimonials-panel-grid { grid-template-columns: 1fr !important; }
          .testimonials-mini-stat-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* Golden ambient glow — top center */}
      <div style={{
        position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Golden ambient glow — bottom left */}
      <div style={{
        position: 'absolute', bottom: '-80px', left: '-100px',
        width: '400px', height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Two-line heading block ── */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>

          {/* Line 1 — small gradient caps */}
          <div style={{
            fontSize: 'clamp(1rem, 2.2vw, 1.4rem)',
            fontWeight: '800',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            background: 'linear-gradient(90deg, #A87C2A 0%, #C9A84C 35%, #F5D78E 60%, #C9A84C 80%, #A87C2A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '14px',
            display: 'block',
            ...fadeUp(0.1),
          }}>
            Trusted by Builders
          </div>

          {/* Line 2 — large heading with laurels */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '16px',
            ...fadeUp(0.22),
          }}>
            <LaurelSvg />
            <h2 style={{
              fontSize: 'clamp(2.8rem, 5.5vw, 4.2rem)',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.1,
            }}>
              <span style={{ color: '#FFFFFF' }}>Loved by </span>
              <span style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #F5D78E 50%, #A87C2A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Builders
              </span>
            </h2>
            <LaurelSvg flip />
          </div>

          {/* Subheading */}
          <p style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '1rem',
            fontWeight: '400',
            margin: 0,
            ...fadeUp(0.34),
          }}>
            Powering the infrastructure behind the next generation of products.
          </p>
        </div>

        {/* ── Outer glass container ── */}
        <div
          className="testimonials-panel-grid"
          style={{
            width: '98%',
            maxWidth: '1600px',
            margin: '0 auto',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(201,168,76,0.22)',
            borderRadius: '28px',
            padding: '20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            boxShadow: '0 0 0 1px rgba(201,168,76,0.08) inset, 0 32px 64px rgba(0,0,0,0.45), 0 8px 32px rgba(0,0,0,0.3), 0 0 80px rgba(201,168,76,0.04)',
            ...fadeUp(0.44),
          }}
        >

          {/* ── Left panel: Stats ── */}
          <div style={{ ...innerPanelStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

            {/* Glass sheen */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
              borderRadius: '16px 16px 0 0',
              pointerEvents: 'none', zIndex: 0,
            }} />

            {/* World map dot pattern */}
            <div style={{
              position: 'absolute', top: '16px', right: '0', width: '55%', height: '65%',
              opacity: 0.25,
              backgroundImage: 'radial-gradient(circle, #A87C2A 1px, transparent 1px)',
              backgroundSize: '10px 8px',
              maskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'%3E%3Cellipse cx='100' cy='60' rx='95' ry='55'/%3E%3C/svg%3E\")",
              WebkitMaskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'%3E%3Cellipse cx='100' cy='60' rx='95' ry='55'/%3E%3C/svg%3E\")",
              maskSize: 'contain', WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
              pointerEvents: 'none', zIndex: 0,
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Users icon */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>

              <div style={{ fontSize: 'clamp(2.8rem, 6vw, 4rem)', fontWeight: '800', color: '#C9A84C', lineHeight: 1, marginBottom: '8px' }}>
                10K+
              </div>

              <p style={{ fontSize: '0.95rem', color: 'rgba(26,18,0,0.65)', margin: '0 0 28px 0', fontWeight: '400', maxWidth: '200px' }}>
                Architectures deployed on AWS via Clyro
              </p>

              <div style={{ height: '1px', backgroundColor: 'rgba(201,168,76,0.25)', marginBottom: '24px' }} />
            </div>

            {/* Mini stat row */}
            <div className="testimonials-mini-stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', position: 'relative', zIndex: 1 }}>
              {miniStats.map((stat, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    backgroundColor: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
                  }}>
                    {stat.icon}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: '#C9A84C', lineHeight: 1.2 }}>{stat.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(26,18,0,0.55)', fontWeight: '500', marginTop: '3px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right panel: Testimonial ── */}
          <div style={{ ...innerPanelStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

            {/* Glass sheen */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
              borderRadius: '16px 16px 0 0',
              pointerEvents: 'none', zIndex: 0,
            }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              {/* Quote mark */}
              <div style={{ fontSize: '3rem', lineHeight: 1, color: '#C9A84C', fontFamily: 'Georgia, serif', marginBottom: '20px', opacity: 0.9 }}>
                "
              </div>

              <p style={{ fontSize: '1.2rem', lineHeight: 1.75, color: '#1A1200', fontWeight: '500', flex: 1, margin: '0 0 28px 0' }}>
                Clyro helped us go from idea to production in a single afternoon. The deployment experience is magical.
              </p>

              <div style={{ height: '1px', backgroundColor: 'rgba(201,168,76,0.3)', marginBottom: '24px' }} />

              {/* Author row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    backgroundColor: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: '700', color: '#A87C2A',
                  }}>
                    AA
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1A1200' }}>Anish Agrawal</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(26,18,0,0.55)' }}>Founder, IndieShop</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#C9A84C" stroke="none">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
