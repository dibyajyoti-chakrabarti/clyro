import BuiltForEngineers from './landing/BuiltForEngineers'
import FeatureShowcase from './landing/FeatureShowcase'
import FinalCTA from './landing/FinalCTA'
import HeroSection from './landing/HeroSection'
import HowClyroWorks from './landing/HowClyroWorks'
import LandingFooter from './landing/LandingFooter'
import LandingNavbar from './landing/LandingNavbar'
import useSmoothScroll from '../../hooks/useSmoothScroll'

/* The landing page owns its own chrome (LandingNavbar / LandingFooter) so it can carry
   the dark theme without touching the shared PublicLayout chrome that /pricing,
   /login and /signup still render. */
export default function Landing() {
  useSmoothScroll()

  return (
    <div className='min-h-screen bg-marketing-bg-warm text-marketing-text-primary'>
      <LandingNavbar />
      {/* HeroSection is pulled up underneath the floating navbar's own row height so
          Hero's atmosphere (gradient + dots + glows) — not the flat root background —
          shows through in the margins/gap around the sticky pill. */}
      <main className='-mt-20 w-full'>
        <HeroSection />
        <HowClyroWorks />
        <FeatureShowcase />
        <BuiltForEngineers />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  )
}
