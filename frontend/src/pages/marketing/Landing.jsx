import Footer from '../../components/layout/Footer'
import CTA from './landing/CTA'
import Hero from './landing/Hero'
import HowItWorks from './landing/HowItWorks'
import Testimonials from './landing/Testimonials'
import TrustedBy from './landing/TrustedBy'
import WhyCrylo from './landing/WhyCrylo'

export default function Landing() {
  return (
    <main className='space-y-10 md:space-y-12'>
      <Hero />
      <TrustedBy />
      <HowItWorks />
      <WhyCrylo />
      <Testimonials />
      <div>
        <CTA />
        <Footer />
      </div>
    </main>
  )
}
