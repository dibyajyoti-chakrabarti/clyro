import { useRef } from "react";

import HowItWorksCard from "../../../components/marketing/HowItWorksCard";
import step1Illustration from "../../../assets/howItWorks/step1_ill.png";
import step2Illustration from "../../../assets/howItWorks/step2_ill.png";
import step3Illustration from "../../../assets/howItWorks/step3_ill.png";
import step4Illustration from "../../../assets/howItWorks/step4_ill.png";
import step5Illustration from "../../../assets/howItWorks/step5_ill.png";
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
    <section ref={sectionRef} className="relative w-full bg-[#F6F2EA]">
      <div className="mx-auto max-w-[1700px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div ref={containerRef}>
          {/* Heading */}
          <div className="pt-16 pb-6">
            <h2 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">
              HOW IT WORKS
            </h2>
            <p className="mt-3 text-lg leading-8 text-black/70 sm:text-xl">
              From Repository to Production
            </p>
            <p className="mt-4 max-w-3xl text-base leading-7 text-black/65 sm:text-lg">
              Five intelligent steps that transform your GitHub repository into
              production-ready AWS infrastructure.
            </p>
          </div>

          {/* Card stage */}
          <div
            style={{
              position: "relative",
              height: CARD_HEIGHT,
              marginBottom: "2rem",
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
    </section>
  );
}
