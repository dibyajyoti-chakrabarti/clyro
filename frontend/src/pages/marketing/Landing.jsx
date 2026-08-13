import BuiltForEngineers from './landing/BuiltForEngineers'
import FeatureShowcase from './landing/FeatureShowcase'
import FinalCTA from './landing/FinalCTA'
import HeroSection from './landing/HeroSection'
import HowClyroWorks from './landing/HowClyroWorks'
import LandingFooter from './landing/LandingFooter'
import LandingNavbar from './landing/LandingNavbar'
import ToolsStrip from './landing/ToolsStrip'
import WhyEngineers from './landing/WhyEngineers'

/* The landing page owns its own chrome (LandingNavbar / LandingFooter) so it can carry
   the light cream theme without touching the shared PublicLayout chrome that /pricing,
   /login and /signup still render. */
export default function Landing() {
  return (
    <div className='min-h-screen bg-[#FDF6ED] text-[#0B0B0B]'>
      <LandingNavbar />
      <main className='w-full'>
        <HeroSection />
        <ToolsStrip />
        <HowClyroWorks />
        <FeatureShowcase />
        <WhyEngineers />
        <BuiltForEngineers />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  )
}
