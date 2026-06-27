import { useRef } from "react";
import HowItWorksCard from "../../../components/marketing/HowItWorksCard";
import step1Illustration from "../../../assets/howItWorks/car1_ill.svg";
import step2Illustration from "../../../assets/howItWorks/car2_ill.svg";
import step3Illustration from "../../../assets/howItWorks/car3_ill.svg";
import step4Illustration from "../../../assets/howItWorks/car4_ill.svg";
import step5Illustration from "../../../assets/howItWorks/car5_ill.svg";
import useHowItWorksAnimation from "../../../hooks/useHowItWorksAnimation";

const steps = [
  {
    step: "01",
    headingTop: "UNDERSTAND YOUR",
    headingHighlight: "REPOSITORY",
    illustration: step1Illustration,
    accent: "yellow",
    stepBg: "#E8D5A3",
  },
  {
    step: "02",
    headingTop: "COLLECT YOUR",
    headingHighlight: "INTENT",
    illustration: step2Illustration,
    accent: "orange",
    stepBg: "#C4A86A",
  },
  {
    step: "03",
    headingTop: "DESIGN YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: step3Illustration,
    accent: "blue",
    stepBg: "#7A5C28",
  },
  {
    step: "04",
    headingTop: "DEPLOY YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: step4Illustration,
    accent: "green",
    stepBg: "#2A1C08",
  },
  {
    step: "05",
    headingTop: "MONITOR & OPTIMIZE YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: step5Illustration,
    accent: "orange",
    stepBg: "#0D0900",
  },
];

const CARD_HEIGHT = "76vh";

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const cardsRef = useRef([]);

  useHowItWorksAnimation(sectionRef, containerRef, cardsRef);

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-6 px-0"
      style={{ backgroundColor: "var(--step-bg, #E8D5A3)" }}
    >
      {/* Rounded wrapper */}
      <div className="w-full max-w-none rounded-3xl overflow-hidden bg-transparent">
        <div className="px-0">
          <div ref={containerRef}>
            {/* Heading */}
            <div className="pt-8 pb-4 flex flex-col items-center text-center">
              {/* Main heading */}
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-none">
                <span style={{ color: "#1A1208" }}>How It </span>
                <span style={{ color: "#6B5020" }}>Works.</span>
              </h2>

              {/* Decorative divider */}
              <div className="mt-5 flex items-center gap-3">
                <div className="h-px w-12 opacity-40" style={{ backgroundColor: "#C9A84C" }} />
                <span className="text-[11px] tracking-[0.15em] uppercase font-medium" style={{ color: "#6B5020" }}>
                  5 Steps
                </span>
                <div className="h-px w-12 opacity-40" style={{ backgroundColor: "#C9A84C" }} />
              </div>
            </div>

            {/* Card stage */}
            <div
              style={{
                position: "relative",
                height: CARD_HEIGHT,
                marginBottom: "4rem",
              }}
            >
              {steps.map((item, index) => (
                <div
                  key={item.step}
                  ref={(el) => {
                    cardsRef.current[index] = el;
                  }}
                  data-step-bg={item.stepBg}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      height: CARD_HEIGHT,
                      width: "100%",
                      maxWidth: "none",
                    }}
                  >
                    <HowItWorksCard
                      step={item.step}
                      headingTop={item.headingTop}
                      headingHighlight={item.headingHighlight}
                      illustration={item.illustration}
                      accent={item.accent}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
