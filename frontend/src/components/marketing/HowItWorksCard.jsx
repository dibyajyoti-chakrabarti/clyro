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

const CARD_THEMES = {
  "01": {
    headingColor: "#1a1200",
    accentGradient: "linear-gradient(135deg, #C49010 0%, #8B6000 60%, #5A3D00 100%)",
    bodyColor: "#2c1f00",
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
};

const CARD_COPY = {
  "01": {
    headingLine1: "UNDERSTAND YOUR",
    headingAccent: "REPOSITORY",
    body: "Analyze your codebase and identify deployment services.",
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

  // Tighten pill sizing for card 03 (5 features = 3 rows) to prevent overflow
  const pillPadding = featureCount >= 5 ? "8px 12px" : "10px 16px";
  const gridGap = featureCount >= 5 ? "8px" : "10px";

  const badgePosition = isEven
    ? { top: "20px", left: "20px" }
    : { top: "20px", right: "20px" };

  return (
    <article
      style={{
        display: "flex",
        flexDirection: isEven ? "row-reverse" : "row",
        width: "100%",
        height: "100%",
        minHeight: "480px",
        borderRadius: "20px 20px 0 0",
        overflow: "hidden",
        position: "relative",
        backgroundColor: bgColor,
        borderTop: theme.cardBorder,
        borderLeft: theme.cardBorder,
        borderRight: theme.cardBorder,
        borderBottom: "none",
        boxShadow: theme.cardShadow,
      }}
    >
      {/* Text half */}
      <div
        style={{
          flex: "0 0 48%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          padding: "40px 40px 36px 40px",
          minHeight: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Heading */}
        <h3
          style={{
            fontWeight: 800,
            fontSize: "clamp(38px, 4vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "0.01em",
            textTransform: "uppercase",
            fontFamily: "inherit",
            margin: 0,
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
            fontSize: "16px",
            lineHeight: 1.5,
            fontWeight: 500,
            margin: 0,
            marginTop: "14px",
          }}
        >
          {copy.body}
        </p>

        {/* Feature pill grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: gridGap,
            marginTop: "18px",
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
                  size={18}
                  color={theme.iconColor}
                  strokeWidth={2}
                  style={{ flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
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

        {/* Tagline — pushed to bottom */}
        <div style={{ marginTop: "auto", paddingTop: "16px", flexShrink: 0 }}>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 800,
              lineHeight: 1.1,
              margin: "0 0 4px 0",
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
              fontSize: "13px",
              fontWeight: 400,
              opacity: 0.5,
              margin: 0,
              color: theme.taglineColor,
            }}
          >
            {copy.taglineSub}
          </p>
        </div>

        {/* CTA button */}
        <button
          type="button"
          style={{
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
          flex: "0 0 52%",
          maxWidth: "52%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {illustration && (
          <img
            src={illustration}
            alt=""
            style={{
              width: step === "01" ? "88%" : "78%",
              height: step === "01" ? "88%" : "78%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              margin: "0 auto",
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
