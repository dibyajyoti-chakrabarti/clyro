import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";

export default function CTA() {
  return (
    <section className="w-full bg-[#F6F2EA] py-8 text-text-primary">
      <div className="mx-auto w-full max-w-[1700px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111318] via-[#1e1608] to-[#111318] px-6 py-6 shadow-[0_20px_80px_rgba(251,191,36,0.10)] ring-1 ring-amber-400/[0.12] lg:px-10 lg:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(251,191,36,0.07),transparent_60%)]" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold leading-tight tracking-[-0.02em] text-white lg:text-4xl">
                Build Your Infrastructure Faster
              </h2>

              <p className="mt-3 text-base leading-7 text-white/70">
                Design, validate, and deploy production-ready AWS architectures
                visually with Clyro.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:items-center lg:justify-end">
              <Link to="/signup">
                <Button
                  size="md"
                  className="min-w-[190px] justify-center rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-300"
                >
                  Start Building Now
                </Button>
              </Link>

              <Link to="/pricing">
                <Button
                  size="md"
                  className="min-w-[160px] justify-center rounded-xl border border-white/20 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/[0.1] hover:border-white/30"
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
