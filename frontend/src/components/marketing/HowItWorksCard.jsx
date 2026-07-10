import { useEffect, useState } from "react";
import {
  Search,
  Zap,
  Code2,
  GitBranch,
  Target,
  Map,
  CheckCircle,
  Layout,
  Globe,
  TrendingDown,
  Shield,
  Cpu,
  MousePointerClick,
  Layers,
  Activity,
  DollarSign,
  Settings,
  Bell,
} from "lucide-react";

// Matches the mobile cutoff already used by useHowItWorksAnimation (window.innerWidth < 768)
function useIsMobileCard() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

const CARD_THEMES = {
  "01": {
    headingColor: "#1a1200",
    accentGradient: "linear-gradient(135deg, #C49010 0%, #8B6000 60%, #5A3D00 100%)",
    bodyColor: "#2c1f00",
    descColor: "rgba(44, 31, 0, 0.75)",
    taglineColor: "#1a1200",
    taglineAccentGradient: "linear-gradient(135deg, #C49010 0%, #8B6000 100%)",
    iconColor: "#7A5200",
    pillBorder: "1px solid rgba(122, 82, 0, 0.2)",
    pillBg: "rgba(122, 82, 0, 0.07)",
    ctaBorder: "1.5px solid rgba(122, 82, 0, 0.4)",
    badgeGradient: "linear-gradient(135deg, #C49010 0%, #8B6000 100%)",
    badgeShadow: "0 4px 16px rgba(150, 100, 0, 0.35), inset 0 1px 0 rgba(255, 220, 80, 0.25)",
    badgeBorder: "2px solid rgba(255, 215, 0, 0.35)",
    badgeText: "#fff8e0",
    cardBorder: "1.5px solid rgba(212, 160, 23, 0.45)",
    cardShadow: "0 -4px 16px rgba(0,0,0,0.08), -4px 0 16px rgba(0,0,0,0.06), 4px 0 16px rgba(0,0,0,0.06)",
  },
  "02": {
    headingColor: "#FFF8E8",
    accentGradient: "linear-gradient(135deg, #FFF0B0 0%, #FFD966 100%)",
    bodyColor: "rgba(255, 248, 232, 0.9)",
    descColor: "rgba(255, 248, 232, 0.7)",
    taglineColor: "#FFF8E8",
    taglineAccentGradient: "linear-gradient(135deg, #FFF0B0 0%, #FFD966 100%)",
    iconColor: "#FFE680",
    pillBorder: "1px solid rgba(255, 240, 180, 0.25)",
    pillBg: "rgba(255, 240, 180, 0.1)",
    ctaBorder: "1.5px solid rgba(255, 240, 180, 0.4)",
    badgeGradient: "linear-gradient(135deg, #C49010 0%, #8B6000 100%)",
    badgeShadow: "0 4px 16px rgba(150, 100, 0, 0.35), inset 0 1px 0 rgba(255, 220, 80, 0.25)",
    badgeBorder: "2px solid rgba(255, 215, 0, 0.35)",
    badgeText: "#fff8e0",
    cardBorder: "1.5px solid rgba(212, 160, 23, 0.45)",
    cardShadow: "0 -4px 16px rgba(0,0,0,0.08), -4px 0 16px rgba(0,0,0,0.06), 4px 0 16px rgba(0,0,0,0.06)",
  },
  "03": {
    headingColor: "#ffffff",
    accentGradient: "linear-gradient(135deg, #F5C842 0%, #D4900A 50%, #A86500 100%)",
    bodyColor: "rgba(255, 255, 255, 0.85)",
    descColor: "rgba(255, 255, 255, 0.65)",
    taglineColor: "#ffffff",
    taglineAccentGradient: "linear-gradient(135deg, #F5C842 0%, #D4900A 100%)",
    iconColor: "#D4A017",
    pillBorder: "1px solid rgba(212, 160, 23, 0.25)",
    pillBg: "rgba(212, 160, 23, 0.08)",
    ctaBorder: "1.5px solid rgba(212, 160, 23, 0.5)",
    badgeGradient: "linear-gradient(135deg, #D4A017 0%, #A67C00 100%)",
    badgeShadow: "0 4px 16px rgba(180, 130, 0, 0.4), inset 0 1px 0 rgba(255, 235, 100, 0.3)",
    badgeBorder: "2px solid rgba(255, 215, 0, 0.35)",
    badgeText: "#fff8e0",
    cardBorder: "1.5px solid rgba(212, 160, 23, 0.6)",
    cardShadow: "0 -4px 20px rgba(0,0,0,0.2), -4px 0 20px rgba(0,0,0,0.15), 4px 0 20px rgba(0,0,0,0.15)",
  },
  "04": {
    headingColor: "#ffffff",
    accentGradient: "linear-gradient(135deg, #F5C842 0%, #D4900A 50%, #A86500 100%)",
    bodyColor: "rgba(255, 255, 255, 0.85)",
    descColor: "rgba(255, 255, 255, 0.65)",
    taglineColor: "#ffffff",
    taglineAccentGradient: "linear-gradient(135deg, #F5C842 0%, #D4900A 100%)",
    iconColor: "#D4A017",
    pillBorder: "1px solid rgba(212, 160, 23, 0.25)",
    pillBg: "rgba(212, 160, 23, 0.08)",
    ctaBorder: "1.5px solid rgba(212, 160, 23, 0.5)",
    badgeGradient: "linear-gradient(135deg, #D4A017 0%, #A67C00 100%)",
    badgeShadow: "0 4px 16px rgba(180, 130, 0, 0.4), inset 0 1px 0 rgba(255, 235, 100, 0.3)",
    badgeBorder: "2px solid rgba(255, 215, 0, 0.35)",
    badgeText: "#fff8e0",
    cardBorder: "1.5px solid rgba(212, 160, 23, 0.6)",
    cardShadow: "0 -4px 20px rgba(0,0,0,0.2), -4px 0 20px rgba(0,0,0,0.15), 4px 0 20px rgba(0,0,0,0.15)",
  },
  "05": {
    headingColor: "#ffffff",
    accentGradient: "linear-gradient(135deg, #F5C842 0%, #D4900A 50%, #A86500 100%)",
    bodyColor: "rgba(255, 255, 255, 0.85)",
    descColor: "rgba(255, 255, 255, 0.65)",
    taglineColor: "#ffffff",
    taglineAccentGradient: "linear-gradient(135deg, #F5C842 0%, #D4900A 100%)",
    iconColor: "#D4A017",
    pillBorder: "1px solid rgba(212, 160, 23, 0.25)",
    pillBg: "rgba(212, 160, 23, 0.08)",
    ctaBorder: "1.5px solid rgba(212, 160, 23, 0.5)",
    badgeGradient: "linear-gradient(135deg, #D4A017 0%, #A67C00 100%)",
    badgeShadow: "0 4px 16px rgba(180, 130, 0, 0.4), inset 0 1px 0 rgba(255, 235, 100, 0.3)",
    badgeBorder: "2px solid rgba(255, 215, 0, 0.35)",
    badgeText: "#fff8e0",
    cardBorder: "1.5px solid rgba(212, 160, 23, 0.6)",
    cardBorderLeft: "none",
    cardBorderRight: "none",
    cardShadow: "0 -4px 20px rgba(0,0,0,0.2)",
  },
};

const CARD_COPY = {
  "01": {
    headingLine1: "UNDERSTAND YOUR",
    headingAccent: "REPOSITORY",
    body: "Analyze your codebase and identify deployment services.",
    desc: "Our engine scans frameworks, languages, and dependencies. No manual config files, no guesswork.",
    taglinePrefix: "We scan. You ",
    taglineAccent: "deploy.",
    taglineSub: "No guesswork, just clarity.",
    ctaLabel: "EXPLORE YOUR REPO",
    features: [
      { label: "AUTO-DETECT", Icon: Search },
      { label: "ZERO CONFIG", Icon: Zap },
      { label: "MULTI-LANGUAGE", Icon: Code2 },
      { label: "SMART SCANNING", Icon: GitBranch },
    ],
  },
  "02": {
    headingLine1: "COLLECT YOUR",
    headingAccent: "INTENT",
    body: "Translate your goals into concrete infrastructure requirements.",
    desc: "Tell us your scalability and cost goals before a single resource is spun up. We map intent to infrastructure.",
    taglinePrefix: "Your goals. Our ",
    taglineAccent: "blueprint.",
    taglineSub: "Clarity before complexity.",
    ctaLabel: "SET YOUR GOALS",
    features: [
      { label: "GOAL-DRIVEN", Icon: Target },
      { label: "INTENT MAPPING", Icon: Map },
      { label: "PRE-FLIGHT CHECK", Icon: CheckCircle },
    ],
  },
  "03": {
    headingLine1: "DESIGN YOUR",
    headingAccent: "INFRASTRUCTURE",
    body: "Generate a production-grade blueprint tailored to your app.",
    desc: "We generate a production-grade architecture diagram tailored to your app. Review and approve before anything is built.",
    taglinePrefix: "Infrastructure ",
    taglineAccent: "mapped.",
    taglineSub: "Optimized before it's built.",
    ctaLabel: "VIEW BLUEPRINT",
    features: [
      { label: "BLUEPRINT GEN", Icon: Layout },
      { label: "REGION-AWARE", Icon: Globe },
      { label: "COST-OPTIMIZED", Icon: TrendingDown },
      { label: "SECURE BY DEFAULT", Icon: Shield },
      { label: "RIGHT-SIZED COMPUTE", Icon: Cpu },
    ],
  },
  "04": {
    headingLine1: "DEPLOY YOUR",
    headingAccent: "INFRASTRUCTURE",
    body: "Provision all cloud resources and go live automatically.",
    desc: "With one click, we provision load balancers, databases, compute, and networking — fully automated.",
    taglinePrefix: "One click. ",
    taglineAccent: "Full stack.",
    taglineSub: "Live in minutes, not days.",
    ctaLabel: "DEPLOY NOW",
    features: [
      { label: "ONE-CLICK DEPLOY", Icon: MousePointerClick },
      { label: "FULL STACK LAUNCH", Icon: Layers },
    ],
  },
  "05": {
    headingLine1: "MONITOR &",
    headingAccent: "OPTIMIZE",
    body: "Track performance, health, and cloud spend in one place.",
    desc: "Get real-time visibility into uptime, latency, and cloud costs. Anomalies surface automatically.",
    taglinePrefix: "Always on. Always ",
    taglineAccent: "optimized.",
    taglineSub: "Your infra, never idle.",
    ctaLabel: "VIEW METRICS",
    features: [
      { label: "LIVE METRICS", Icon: Activity },
      { label: "SPEND TRACKING", Icon: DollarSign },
      { label: "AUTO-OPTIMIZE", Icon: Settings },
      { label: "ANOMALY ALERTS", Icon: Bell },
    ],
  },
};

export default function HowItWorksCard({
  step,
  illustration,
  bgColor,
}) {
  const theme = CARD_THEMES[step] ?? CARD_THEMES["05"];
  const copy = CARD_COPY[step] ?? CARD_COPY["05"];
  const isEven = Number(step) % 2 === 0;
  const featureCount = copy.features.length;
  const hasOddFeatures = featureCount % 2 !== 0;
  const isMobile = useIsMobileCard();

  // Card 3 has 5 features (3 rows) — tighten to prevent overflow
  const pillPadding = featureCount >= 5 ? "8px 12px" : "9px 14px";
  const gridGap = featureCount >= 5 ? "7px" : "10px";

  const badgePosition = isMobile
    ? { top: "-34px", left: "50%", transform: "translateX(-50%)" }
    : isEven
    ? { top: "20px", left: "20px" }
    : { top: "20px", right: "20px" };

  return (
    <article
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : isEven ? "row-reverse" : "row",
        width: "100%",
        height: isMobile ? "auto" : "100%",
        minHeight: isMobile ? undefined : "480px",
        paddingTop: isMobile ? "48px" : 0,
        borderRadius: "20px 20px 0 0",
        overflow: "hidden",
        position: "relative",
        backgroundColor: bgColor,
        borderTop: theme.cardBorder,
        borderLeft: theme.cardBorderLeft ?? theme.cardBorder,
        borderRight: theme.cardBorderRight ?? theme.cardBorder,
        borderBottom: "none",
        boxShadow: theme.cardShadow,
      }}
    >
      {/* Text half */}
      <div
        style={{
          order: isMobile ? 2 : 0,
          flex: isMobile ? "0 0 auto" : "0 0 48%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          padding: isMobile ? "14px 24px 48px" : "44px 48px 40px 48px",
          minHeight: isMobile ? undefined : "100%",
          boxSizing: "border-box",
          overflow: isMobile ? "visible" : "hidden",
        }}
      >
        {/* Heading */}
        <h3
          style={{
            fontWeight: 800,
            fontSize: isMobile ? "clamp(28px, 9vw, 38px)" : "clamp(44px, 5vw, 68px)",
            lineHeight: isMobile ? 1.08 : 1.0,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            overflowWrap: isMobile ? "break-word" : undefined,
            wordBreak: isMobile ? "break-word" : undefined,
          }}
        >
          <span style={{ color: theme.headingColor, display: "block" }}>
            {copy.headingLine1}
          </span>
          <span
            style={{
              display: "block",
              background: theme.accentGradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {copy.headingAccent}
          </span>
        </h3>

        {/* Body line */}
        <p
          style={{
            color: theme.bodyColor,
            fontSize: "18px",
            lineHeight: 1.5,
            fontWeight: 500,
            margin: 0,
            marginTop: "18px",
          }}
        >
          {copy.body}
        </p>

        {/* Description paragraph — hidden on mobile, visible on desktop/tablet */}
        <p
          style={{
            display: isMobile ? "none" : "block",
            color: theme.descColor,
            fontSize: "14px",
            lineHeight: 1.7,
            fontWeight: 400,
            margin: 0,
            marginTop: "8px",
          }}
        >
          {copy.desc}
        </p>

        {/* Feature pill grid — hidden on mobile, visible on desktop/tablet */}
        <div
          style={{
            display: isMobile ? "none" : "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: gridGap,
            marginTop: "20px",
            marginBottom: "0",
            flexShrink: 0,
          }}
        >
          {copy.features.map(({ label, Icon }, i) => {
            const isLast = i === featureCount - 1;
            const spanFull = isLast && hasOddFeatures;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: pillPadding,
                  borderRadius: "10px",
                  border: theme.pillBorder,
                  background: theme.pillBg,
                  gridColumn: spanFull ? "span 2" : undefined,
                }}
              >
                <Icon
                  size={17}
                  color={theme.iconColor}
                  strokeWidth={2}
                  style={{ flexShrink: 0, width: "17px", height: "17px" }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    color: theme.bodyColor,
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tagline — pushed to bottom; hidden on mobile, visible on desktop/tablet */}
        <div style={{ display: isMobile ? "none" : "block", marginTop: "auto", paddingTop: "16px", flexShrink: 0 }}>
          <p
            style={{
              fontSize: "26px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              margin: "0 0 6px 0",
            }}
          >
            <span style={{ color: theme.taglineColor }}>{copy.taglinePrefix}</span>
            <span
              style={{
                background: theme.taglineAccentGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {copy.taglineAccent}
            </span>
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 400,
              opacity: 0.5,
              margin: 0,
              color: theme.taglineColor,
            }}
          >
            {copy.taglineSub}
          </p>
        </div>

        {/* CTA button — hidden on mobile, visible on desktop/tablet */}
        <button
          type="button"
          style={{
            display: isMobile ? "none" : "inline-block",
            marginTop: "14px",
            padding: "9px 20px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "transparent",
            border: theme.ctaBorder,
            borderRadius: "6px",
            color: theme.taglineColor,
            cursor: "pointer",
            alignSelf: "flex-start",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        >
          {copy.ctaLabel}
        </button>
      </div>

      {/* Illustration half */}
      <div
        style={{
          order: isMobile ? 1 : 0,
          flex: isMobile ? "0 0 auto" : "0 0 52%",
          width: isMobile ? "100%" : undefined,
          maxWidth: isMobile ? "100%" : "52%",
          height: isMobile ? "290px" : undefined,
          position: "relative",
          overflow: isMobile ? "visible" : "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "0 24px" : 0,
          boxSizing: "border-box",
        }}
      >
        {illustration && (
          <img
            src={illustration}
            alt=""
            style={{
              width: isMobile ? "100%" : step === "01" ? "100%" : "95%",
              height: isMobile ? "100%" : step === "01" ? "100%" : "95%",
              maxWidth: isMobile ? "100%" : step === "01" ? "100%" : "95%",
              maxHeight: isMobile ? "100%" : step === "01" ? "100%" : "95%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              padding: isMobile ? (step === "01" ? "4px" : "6px") : step === "01" ? "8px" : "12px",
              boxSizing: "border-box",
            }}
          />
        )}

        {/* Step number badge */}
        <div
          style={{
            position: "absolute",
            ...badgePosition,
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            fontWeight: 800,
            fontFamily: "inherit",
            letterSpacing: "0.02em",
            background: theme.badgeGradient,
            color: theme.badgeText,
            border: theme.badgeBorder,
            boxShadow: theme.badgeShadow,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          {step}
        </div>
      </div>
    </article>
  );
}
