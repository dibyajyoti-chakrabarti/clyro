import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Package, Tag, ArrowRight } from "lucide-react";
import Button from "../../../components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

export default function CTA() {
  const sectionRef        = useRef(null);
  const cardRef           = useRef(null);
  const headingRef        = useRef(null);
  const dividerRef        = useRef(null);
  const subtextRef        = useRef(null);
  const buttonsRef        = useRef(null);
  const primaryRef        = useRef(null);
  const secondaryRef      = useRef(null);
  const primaryArrowRef   = useRef(null);
  const secondaryArrowRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // ── Card entrance ──
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20, scale: 0.96 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.65, ease: "power2.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 85%", once: true },
        }
      );

      // Stagger inner content after card arrives
      gsap.fromTo(
        [headingRef.current, dividerRef.current, subtextRef.current, buttonsRef.current],
        { opacity: 0, y: 14 },
        {
          opacity: 1, y: 0,
          duration: 0.45, ease: "power2.out", stagger: 0.1,
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
          delay: 0.25,
        }
      );

      // ── Card hover lift ──
      const cardEl = cardRef.current;
      const enterCard = () => gsap.to(cardEl, {
        y: -3, duration: 0.4, ease: "power1.out",
        boxShadow: "0 0 0 1px rgba(240,168,48,0.75), 0 0 48px rgba(240,168,48,0.45), 0 8px 40px rgba(0,0,0,0.25)",
      });
      const leaveCard = () => gsap.to(cardEl, {
        y: 0, duration: 0.4, ease: "power1.out",
        boxShadow: "0 0 0 1px rgba(240,168,48,0.55), 0 0 30px rgba(240,168,48,0.32), 0 4px 24px rgba(0,0,0,0.18)",
      });
      cardEl?.addEventListener("mouseenter", enterCard);
      cardEl?.addEventListener("mouseleave", leaveCard);

      // ── Primary button hover ──
      const primaryEl      = primaryRef.current;
      const primaryArrowEl = primaryArrowRef.current;
      const enterPrimary = () => {
        gsap.to(primaryEl, { scale: 1.03, y: -2, duration: 0.25, ease: "power1.out",
          boxShadow: "0 8px 28px rgba(0,0,0,0.4)" });
        gsap.to(primaryArrowEl, { x: 4, duration: 0.2, ease: "power1.out" });
      };
      const leavePrimary = () => {
        gsap.to(primaryEl, { scale: 1, y: 0, duration: 0.25, ease: "power1.out",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)" });
        gsap.to(primaryArrowEl, { x: 0, duration: 0.2, ease: "power1.out" });
      };
      primaryEl?.addEventListener("mouseenter", enterPrimary);
      primaryEl?.addEventListener("mouseleave", leavePrimary);

      // ── Secondary button hover ──
      const secondaryEl      = secondaryRef.current;
      const secondaryArrowEl = secondaryArrowRef.current;
      const enterSecondary = () => {
        gsap.to(secondaryEl, { y: -2, duration: 0.25, ease: "power1.out",
          backgroundColor: "rgba(255,255,255,0.35)", borderColor: "rgba(100,55,15,0.8)" });
        gsap.to(secondaryArrowEl, { x: 4, duration: 0.2, ease: "power1.out" });
      };
      const leaveSecondary = () => {
        gsap.to(secondaryEl, { y: 0, duration: 0.25, ease: "power1.out",
          backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(100,55,15,0.55)" });
        gsap.to(secondaryArrowEl, { x: 0, duration: 0.2, ease: "power1.out" });
      };
      secondaryEl?.addEventListener("mouseenter", enterSecondary);
      secondaryEl?.addEventListener("mouseleave", leaveSecondary);

      return () => {
        cardEl?.removeEventListener("mouseenter", enterCard);
        cardEl?.removeEventListener("mouseleave", leaveCard);
        primaryEl?.removeEventListener("mouseenter", enterPrimary);
        primaryEl?.removeEventListener("mouseleave", leavePrimary);
        secondaryEl?.removeEventListener("mouseenter", enterSecondary);
        secondaryEl?.removeEventListener("mouseleave", leaveSecondary);
      };
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full pb-8 pt-0"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div style={{ width: '98%', maxWidth: '1400px', margin: '0 auto' }}>
        <div
          ref={cardRef}
          className="cta-card-inner relative overflow-hidden"
          style={{
            borderRadius: "26px",
            background: "radial-gradient(circle at 20% 20%, #FDF6E8 0%, #F5C563 45%, #E89B2E 75%, #D9851F 100%)",
            padding: "44px 52px",
            boxShadow: "0 0 0 1px rgba(240,168,48,0.55), 0 0 30px rgba(240,168,48,0.32), 0 4px 24px rgba(0,0,0,0.18)",
          }}
        >

          {/* ── Ribbon SVG — sweeping diagonals, right-biased ── */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 0 }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 900 320"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Ribbon 1 — wide sweep upper-right to lower-left */}
              <path
                d="M 900 0 C 750 40 600 20 450 140 C 300 260 200 290 0 320"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Ribbon 2 — tighter, offset below ribbon 1 */}
              <path
                d="M 900 60 C 780 90 650 70 530 170 C 410 270 300 295 80 320"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Ribbon 3 — bottom edge, most subtle */}
              <path
                d="M 900 140 C 820 165 700 155 600 220 C 500 285 380 310 160 320"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {/* Ribbon 4 — upper right accent */}
              <path
                d="M 900 -20 C 820 30 730 10 660 80 C 590 150 560 200 480 250"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* ── Content ── */}
          <div
            className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between"
            style={{ gap: "0" }}
          >

            {/* Left: text block */}
            <div className="cta-text-pad flex-1" style={{ paddingRight: "48px" }}>
              <h2
                ref={headingRef}
                className="text-3xl font-bold leading-tight tracking-[-0.02em] sm:text-4xl lg:text-5xl"
                style={{ color: "#1A1F2B" }}
              >
                Build Your Infrastructure.
                <br />
                Ship with{" "}
                <span style={{ color: "#E8941A" }}>Confidence.</span>
              </h2>

              {/* Divider */}
              <div
                ref={dividerRef}
                className="mt-4 rounded-full"
                style={{ width: "2.5rem", height: "3px", backgroundColor: "#E8941A" }}
              />

              <p
                ref={subtextRef}
                className="mt-3 text-sm leading-6 sm:text-base sm:leading-7"
                style={{ color: "#6B5F4F", maxWidth: "38ch" }}
              >
                Design, validate, and deploy production-ready AWS architectures
                visually with Clyro.
              </p>
            </div>

            {/* Right: buttons */}
            <div
              ref={buttonsRef}
              className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-stretch lg:flex-row lg:items-center"
              style={{ flexShrink: 0, gap: "14px" }}
            >
              {/* Primary */}
              <Link to="/signup">
                <Button
                  ref={primaryRef}
                  size="md"
                  className="w-full justify-center sm:w-auto"
                  style={{
                    borderRadius: "13px",
                    padding: "14px 28px",
                    background: "linear-gradient(135deg, #2A1B0E 0%, #7A4A0A 55%, #B8730F 100%)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    border: "none",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Package size={16} strokeWidth={1.8} />
                  Start Building Now
                  <span ref={primaryArrowRef} style={{ display: "inline-flex", alignItems: "center" }}>
                    <ArrowRight size={15} strokeWidth={2} />
                  </span>
                </Button>
              </Link>

              {/* Secondary */}
              <Link to="/pricing">
                <Button
                  ref={secondaryRef}
                  size="md"
                  className="w-full justify-center sm:w-auto"
                  style={{
                    borderRadius: "13px",
                    padding: "14px 28px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border: "1.5px solid rgba(100,55,15,0.55)",
                    color: "#6B4423",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Tag size={15} strokeWidth={1.8} />
                  View Pricing
                  <span ref={secondaryArrowRef} style={{ display: "inline-flex", alignItems: "center" }}>
                    <ArrowRight size={15} strokeWidth={2} />
                  </span>
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Responsive padding override */}
      <style>{`
        @media (max-width: 767px) {
          .cta-card-inner { padding: 28px 24px !important; }
          .cta-text-pad  { padding-right: 0 !important; }
        }
      `}</style>
    </section>
  );
}
