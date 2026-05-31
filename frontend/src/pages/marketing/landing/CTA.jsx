import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'

export default function CTA() {
  return (
    <section className="w-full bg-background text-text-primary">
      <div className="mx-auto w-full max-w-[1700px] px-4 pb-5 sm:px-6 lg:px-10 xl:px-12">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#070b17] px-6 py-5 lg:px-10 lg:py-6">
          {/* Gradient Glow Layer */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 top-0 h-full w-[320px] bg-[radial-gradient(circle_at_left,rgba(255,196,0,0.22),transparent_70%)] blur-2xl" />

            <div className="absolute bottom-0 left-0 h-[120px] w-full bg-[linear-gradient(to_right,rgba(255,196,0,0.10),transparent_40%)]" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left Content */}
            <div className="max-w-2xl">
              <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">
                Build Your Infrastructure Faster
              </h2>

              <p className="mt-2 text-sm leading-6 text-text-muted">
                Design, validate, and deploy production-ready AWS architectures
                visually with Clyro.
              </p>
            </div>

            {/* Right Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row lg:items-center lg:justify-end">
              <Link to="/signup">
                <Button
                  size="md"
                  className="min-w-[190px] justify-center rounded-xl px-6 py-3 text-sm font-medium"
                >
                  Start Building Now
                </Button>
              </Link>

              <Link to="/pricing">
                <Button
                  variant="secondary"
                  size="md"
                  className="min-w-[160px] justify-center rounded-xl border border-white/[0.08] bg-transparent px-6 py-3 text-sm font-medium"
                >
                  Book a Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
