import { useRef } from "react";
import HowItWorksCard from "../../../components/marketing/HowItWorksCard";
import card1 from "../../../assets/howItWorks/card1.webp";
import card2 from "../../../assets/howItWorks/card2.webp";
import card3 from "../../../assets/howItWorks/card3.webp";
import card4 from "../../../assets/howItWorks/card4.webp";
import card5 from "../../../assets/howItWorks/card5.webp";
import useHowItWorksAnimation from "../../../hooks/useHowItWorksAnimation";

const steps = [
  {
    step: "01",
    headingTop: "UNDERSTAND YOUR",
    headingHighlight: "REPOSITORY",
    illustration: card1,
    bgColor: "#F5EDD6",
    stepBg: "#F5EDD6",
  },
  {
    step: "02",
    headingTop: "COLLECT YOUR",
    headingHighlight: "INTENT",
    illustration: card2,
    bgColor: "#B8922A",
    stepBg: "#B8922A",
  },
  {
    step: "03",
    headingTop: "DESIGN YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: card3,
    bgColor: "#6B4F1E",
    stepBg: "#6B4F1E",
  },
  {
    step: "04",
    headingTop: "DEPLOY YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: card4,
    bgColor: "#221609",
    stepBg: "#221609",
  },
  {
    step: "05",
    headingTop: "MONITOR & OPTIMIZE YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: card5,
    bgColor: "#0F0A03",
    stepBg: "#0F0A03",
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
      style={{ backgroundColor: "var(--step-bg, #EAD9A8)" }}
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
                      bgColor={item.bgColor}
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
