import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function useHowItWorksAnimation(
  sectionRef,
  containerRef,
  cardsRef,
) {
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const cards = cardsRef.current.filter(Boolean);

    if (!section || cards.length === 0) return;

    if (window.innerWidth < 768) {
      gsap.set(cards, { clearProps: "all" });
      return;
    }

    const ctx = gsap.context(() => {
      cards.forEach((card, i) => {
        gsap.set(card, {
          zIndex: i + 1,
          yPercent: i === 0 ? 0 : 100,
          scale: 1,
          transformOrigin: "center top",
          willChange: "transform",
        });
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section, // ← pin the SECTION (top-level element)
          start: "top top",
          end: () => `+=${(cards.length - 1) * window.innerHeight}`,
          pin: true,
          pinSpacing: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      for (let i = 0; i < cards.length - 1; i++) {
        tl.to(cards[i], { scale: 0.96, ease: "none", duration: 1 }, i).to(
          cards[i + 1],
          { yPercent: 0, ease: "none", duration: 1 },
          i,
        );
      }
    }, section);

    return () => {
      ctx.revert();
      ScrollTrigger.refresh();
    };
  }, [sectionRef, containerRef, cardsRef]);
}
