import { useEffect, useState } from "react";

// Single source of truth for the "How It Works" cards' phone/tablet vs desktop
// split — Tailwind's `lg` breakpoint (1024px). HowItWorksCard.jsx, HowItWorks.jsx,
// and useHowItWorksAnimation.js all key off this same value so the single-column
// layout, the GSAP pin/scrub disable, and the section's own sizing stay in sync.
export const CARD_DESKTOP_BREAKPOINT = 1024;

export default function useIsBelowCardBreakpoint() {
  const [isBelow, setIsBelow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < CARD_DESKTOP_BREAKPOINT,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${CARD_DESKTOP_BREAKPOINT - 1}px)`);
    const onChange = (e) => setIsBelow(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isBelow;
}
