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
  },
  {
    step: "02",
    headingTop: "COLLECT YOUR",
    headingHighlight: "INTENT",
    illustration: step2Illustration,
    accent: "orange",
  },
  {
    step: "03",
    headingTop: "DESIGN YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: step3Illustration,
    accent: "blue",
  },
  {
    step: "04",
    headingTop: "DEPLOY YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: step4Illustration,
    accent: "green",
  },
  {
    step: "05",
    headingTop: "MONITOR & OPTIMIZE YOUR",
    headingHighlight: "INFRASTRUCTURE",
    illustration: step5Illustration,
    accent: "orange",
  },
];

const CARD_HEIGHT = "62vh";

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const cardsRef = useRef([]);

  useHowItWorksAnimation(sectionRef, containerRef, cardsRef);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-[#F6F2EA] py-6 px-4 sm:px-6"
    >
      {/* Rounded wrapper */}
      <div className="mx-auto max-w-[1700px] bg-[#F6F2EA] rounded-3xl overflow-hidden">
        <div className="px-4 sm:px-6 lg:px-10 xl:px-12">
          <div ref={containerRef}>
            {/* Heading */}
            <div className="pt-16 pb-10 flex flex-col items-center text-center">
              {/* Main heading */}
              <h2 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl leading-none">
                <span className="text-black">How It </span>
                <span className="text-black/15">Works.</span>
              </h2>

              {/* Decorative divider */}
              <div className="mt-8 flex items-center gap-3">
                <div className="h-px w-12 bg-black/10" />
                <span className="text-[11px] tracking-[0.15em] text-black/30 uppercase font-medium">
                  5 Steps
                </span>
                <div className="h-px w-12 bg-black/10" />
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
                      maxWidth: "1600px",
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
