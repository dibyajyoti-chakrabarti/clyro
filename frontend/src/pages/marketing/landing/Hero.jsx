import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import landingArt from '../../../assets/landing_art.svg'

export default function Hero() {
  return (
    <section className="w-full overflow-visible border-b border-white/[0.08] bg-background text-text-primary py-16 lg:py-10">
      <div className="mx-auto grid w-full max-w-[1700px] gap-4 px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-6 lg:px-10 xl:px-12">
        <div>
          <div className="space-y-5">
            <h1 className="text-4xl font-bold leading-tight tracking-normal text-text-primary sm:text-5xl lg:text-6xl">
              Design Cloud Infrastructure Visually. Deploy Instantly.
            </h1>
            <p className="text-base leading-7 text-text-muted sm:text-lg">
              Build, validate, and deploy production-ready AWS architectures
              from a single intelligent canvas.
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Start Building
              </Button>
            </Link>
            <Link to="/pricing" className="sm:w-auto">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                See Pricing
              </Button>
            </Link>
          </div>
        </div>

        <img
          src={landingArt}
          alt="Clyro platform illustration"
          className="h-auto w-full origin-center scale-105 lg:scale-105 xl:scale-110"
        />
      </div>
    </section>
  );
}
