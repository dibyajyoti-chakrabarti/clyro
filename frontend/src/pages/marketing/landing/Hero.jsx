import { Link } from 'react-router-dom'
import heroBg from '../../../assets/hero_background.png'

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#040812] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.25)_55%,rgba(0,0,0,0.15)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.30)_0%,rgba(0,0,0,0.18)_45%,rgba(0,0,0,0)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.25)]"
        aria-hidden="true"
      />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[760px] flex-col items-center text-center">
          <h1 className="animate-[fadeUp_600ms_ease-out_both] text-4xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Deploy to AWS.
            <br />
            <span className="bg-gradient-to-r from-[#FFC400] via-[#ffd75a] to-[#fff1bf] bg-clip-text text-transparent">
              Without the complexity.
            </span>
          </h1>

          <p className="animate-[fadeUp_600ms_ease-out_both] mt-6 max-w-[560px] text-lg leading-8 text-white/80">
            Deploy your GitHub projects to AWS in minutes with intelligent
            automation and zero infrastructure headaches.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
            <Link
              to="/signup"
              className="animate-[fadeUp_600ms_ease-out_both] inline-flex h-[52px] items-center justify-center rounded-xl bg-[#FFC400] px-7 text-sm font-semibold text-[#111111] shadow-[0_10px_32px_rgba(255,196,0,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105"
            >
              Start Building
            </Link>
            <Link
              to="/pricing"
              className="animate-[fadeUp_600ms_ease-out_both] inline-flex h-[52px] items-center justify-center rounded-xl border border-white/15 bg-white/0 px-7 text-sm font-semibold text-white/90 backdrop-blur-md transition-colors duration-200 hover:border-[#FFC400] hover:bg-white/5"
            >
              Explore Features
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  )
}
