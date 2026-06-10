import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";

export default function CTA() {
  return (
    <section className="w-full bg-[#F6F2EA] py-8 text-text-primary">
      <div className="mx-auto w-full max-w-[1700px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF6A13] via-[#F97316] to-[#EAB308] px-6 py-6 shadow-[0_20px_60px_rgba(249,115,22,0.25)] lg:px-10 lg:py-8">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Left Content */}
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold leading-tight tracking-[-0.02em] text-white lg:text-4xl">
                Build Your Infrastructure Faster
              </h2>

              <p className="mt-3 text-base leading-7 text-white/90">
                Design, validate, and deploy production-ready AWS architectures
                visually with Clyro.
              </p>
            </div>

            {/* Right Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row lg:items-center lg:justify-end">
              <Link to="/signup">
                <Button
                  size="md"
                  className="min-w-[190px] justify-center rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-black/90"
                >
                  Start Building Now
                </Button>
              </Link>

              <Link to="/pricing">
                <Button
                  size="md"
                  className="min-w-[160px] justify-center rounded-xl border border-white/30 bg-transparent px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
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
