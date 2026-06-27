import { Sparkles } from "lucide-react";

const CARD_THEMES = {
  "01": {
    cardBorder: "1px solid rgba(0,0,0,0.12)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    leftPanelBg: "#F0E6CC",
    rightPanelBg: "#1A1208",
    headingColor: "#1A1208",
    highlightColor: "#C9A84C",
    bodyTextColor: "#3D2E10",
    badgeBg: "#1A1208",
    badgeText: "#C9A84C",
    stepNumBg: "#1A1208",
    stepNumText: "#C9A84C",
    stepNumBorder: "rgba(201,168,76,0.35)",
    chipBg: "#FFFFFF",
    chipBorder: "rgba(0,0,0,0.08)",
    chipText: "#1A1208",
    chipIcon: "#C9A84C",
    taglineBg: "rgba(255,255,255,0.6)",
    taglineBorder: "rgba(0,0,0,0.08)",
    taglineMain: "#1A1208",
    taglineSub: "#6B5020",
    taglineIcon: "#C9A84C",
    statusBg: "#1A1208",
    statusBorder: "rgba(201,168,76,0.20)",
    statusLabel: "rgba(232,213,163,0.5)",
    statusText: "#E8D5A3",
  },
  "02": {
    cardBorder: "1px solid rgba(0,0,0,0.12)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    leftPanelBg: "#D4B97A",
    rightPanelBg: "#1A1208",
    headingColor: "#1A1208",
    highlightColor: "#8B5E10",
    bodyTextColor: "#2E1F08",
    badgeBg: "#1A1208",
    badgeText: "#D4B97A",
    stepNumBg: "#1A1208",
    stepNumText: "#D4B97A",
    stepNumBorder: "rgba(212,185,122,0.35)",
    chipBg: "rgba(255,255,255,0.45)",
    chipBorder: "rgba(0,0,0,0.10)",
    chipText: "#1A1208",
    chipIcon: "#8B5E10",
    taglineBg: "rgba(255,255,255,0.35)",
    taglineBorder: "rgba(0,0,0,0.08)",
    taglineMain: "#1A1208",
    taglineSub: "#3D2508",
    taglineIcon: "#8B5E10",
    statusBg: "#1A1208",
    statusBorder: "rgba(212,185,122,0.20)",
    statusLabel: "rgba(212,185,122,0.5)",
    statusText: "#D4B97A",
  },
  "03": {
    cardBorder: "1px solid rgba(255,255,255,0.08)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    leftPanelBg: "#5C3D10",
    rightPanelBg: "#0F0A04",
    headingColor: "#F0E6CC",
    highlightColor: "#C9A84C",
    bodyTextColor: "#C4A87A",
    badgeBg: "#C9A84C",
    badgeText: "#1A1208",
    stepNumBg: "#C9A84C",
    stepNumText: "#1A1208",
    stepNumBorder: "rgba(201,168,76,0.35)",
    chipBg: "rgba(255,255,255,0.07)",
    chipBorder: "rgba(255,255,255,0.12)",
    chipText: "#F0E6CC",
    chipIcon: "#C9A84C",
    taglineBg: "rgba(255,255,255,0.06)",
    taglineBorder: "rgba(255,255,255,0.10)",
    taglineMain: "#F0E6CC",
    taglineSub: "#C4A87A",
    taglineIcon: "#C9A84C",
    statusBg: "rgba(255,255,255,0.07)",
    statusBorder: "rgba(255,255,255,0.10)",
    statusLabel: "rgba(255,255,255,0.40)",
    statusText: "#F0E6CC",
  },
  "04": {
    cardBorder: "1px solid rgba(255,255,255,0.06)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    leftPanelBg: "#1C1005",
    rightPanelBg: "#0A0602",
    headingColor: "#F0E6CC",
    highlightColor: "#C9A84C",
    bodyTextColor: "#A08B68",
    badgeBg: "#C9A84C",
    badgeText: "#1A1208",
    stepNumBg: "#C9A84C",
    stepNumText: "#1A1208",
    stepNumBorder: "rgba(201,168,76,0.35)",
    chipBg: "rgba(255,255,255,0.05)",
    chipBorder: "rgba(255,255,255,0.09)",
    chipText: "#E8D5A3",
    chipIcon: "#C9A84C",
    taglineBg: "rgba(255,255,255,0.04)",
    taglineBorder: "rgba(255,255,255,0.08)",
    taglineMain: "#E8D5A3",
    taglineSub: "#A08B68",
    taglineIcon: "#C9A84C",
    statusBg: "rgba(255,255,255,0.05)",
    statusBorder: "rgba(255,255,255,0.08)",
    statusLabel: "rgba(255,255,255,0.40)",
    statusText: "#E8D5A3",
  },
  "05": {
    cardBorder: "1px solid rgba(255,255,255,0.04)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    leftPanelBg: "#0D0900",
    rightPanelBg: "#070400",
    headingColor: "#F0E6CC",
    highlightColor: "#C9A84C",
    bodyTextColor: "#7A6848",
    badgeBg: "#C9A84C",
    badgeText: "#0D0900",
    stepNumBg: "#C9A84C",
    stepNumText: "#0D0900",
    stepNumBorder: "rgba(201,168,76,0.35)",
    chipBg: "rgba(255,255,255,0.04)",
    chipBorder: "rgba(255,255,255,0.07)",
    chipText: "#E8D5A3",
    chipIcon: "#C9A84C",
    taglineBg: "rgba(255,255,255,0.03)",
    taglineBorder: "rgba(255,255,255,0.06)",
    taglineMain: "#E8D5A3",
    taglineSub: "#7A6848",
    taglineIcon: "#C9A84C",
    statusBg: "rgba(255,255,255,0.04)",
    statusBorder: "rgba(255,255,255,0.06)",
    statusLabel: "rgba(255,255,255,0.35)",
    statusText: "#E8D5A3",
  },
};

const CARD_COPY = {
  "01": {
    summary: "Analyze your codebase and identify the services required for deployment.",
    ctaMain: "We scan. You deploy.",
    ctaSub: "No guesswork, just clarity.",
  },
  "02": {
    summary: "Understand your infrastructure goals before generating the architecture.",
    ctaMain: "Your goals. Our blueprint.",
    ctaSub: "Clarity before complexity.",
  },
  "03": {
    summary: "Create an optimized deployment blueprint based on your application needs.",
    ctaMain: "Infrastructure mapped.",
    ctaSub: "Optimized before it's built.",
  },
  "04": {
    summary: "Provision cloud resources and launch your architecture automatically.",
    ctaMain: "One click. Full stack.",
    ctaSub: "Live in minutes, not days.",
  },
  "05": {
    summary: "Track performance, health, and cloud spend in one place.",
    ctaMain: "Always on. Always optimized.",
    ctaSub: "Ship with confidence.",
  },
};

// Absolute badge anchored to the card's top-right corner
function CornerNumberBadge({ step, theme }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "80px",
        height: "80px",
        background: theme.stepNumBg,
        // TL:0  TR:16px (matches card corner)  BR:0  BL:16px (curved inward)
        borderRadius: "0 16px 0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: theme.stepNumText,
          fontSize: "36px",
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: "inherit",
        }}
      >
        {step}
      </span>
    </div>
  );
}

function TextColumn({ step, headingTop, headingHighlight, copy, theme }) {
  return (
    <div
      className="w-full lg:w-[52%] lg:flex-shrink-0 flex flex-col h-full"
      style={{
        padding: "48px",
        background: theme.leftPanelBg,
        boxSizing: "border-box",
      }}
    >
      {/* 1. Badge row: pill + sparkle inline */}
      <div className="flex items-center" style={{ gap: "10px" }}>
        <span
          style={{
            background: theme.badgeBg,
            color: theme.badgeText,
            letterSpacing: "0.08em",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
            lineHeight: 1,
            display: "inline-block",
          }}
        >
          STEP {step}
        </span>
        <span
          style={{
            color: theme.highlightColor,
            fontSize: "16px",
            opacity: 0.8,
            lineHeight: 1,
          }}
        >
          ✦
        </span>
      </div>

      {/* 2. Main heading block */}
      <h3
        style={{
          marginTop: "24px",
          color: theme.headingColor,
          fontWeight: 800,
          fontSize: "clamp(36px, 4vw, 52px)",
          lineHeight: 1.05,
          textTransform: "uppercase",
          fontFamily: "inherit",
        }}
      >
        {headingTop}
        <br />
        <span style={{ color: theme.highlightColor }}>{headingHighlight}</span>
      </h3>

      {/* Decorative sparkle near heading */}
      <span
        style={{
          color: theme.highlightColor,
          fontSize: "16px",
          opacity: 0.8,
          marginTop: "12px",
          display: "inline-block",
          lineHeight: 1,
        }}
      >
        ✦
      </span>

      {/* 3. Body text */}
      <p
        style={{
          marginTop: "20px",
          color: theme.bodyTextColor,
          fontSize: "15px",
          lineHeight: 1.6,
          maxWidth: "380px",
        }}
      >
        {copy.summary}
      </p>

      {/* 4. Bottom tagline — flex push to bottom */}
      <div
        className="flex items-center"
        style={{ gap: "12px", marginTop: "auto", paddingTop: "32px" }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: `1px solid ${theme.chipBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sparkles size={18} style={{ color: theme.taglineIcon }} strokeWidth={2} />
        </div>
        <div>
          <div
            style={{
              color: theme.taglineMain,
              fontWeight: 700,
              fontSize: "15px",
              lineHeight: 1.3,
            }}
          >
            {copy.ctaMain}
          </div>
          <div
            style={{
              color: theme.taglineSub,
              fontSize: "13px",
              lineHeight: 1.4,
              marginTop: "2px",
            }}
          >
            {copy.ctaSub}
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualColumn({ illustration, theme }) {
  return (
    <div
      className="hidden lg:block flex-1 min-w-0 h-full"
      style={{ background: theme.rightPanelBg }}
    >
      <img
        src={illustration}
        alt=""
        className="block select-none pointer-events-none w-full h-full"
        style={{ objectFit: "cover", display: "block" }}
        draggable={false}
      />
    </div>
  );
}

export default function HowItWorksCard({
  step,
  headingTop,
  headingHighlight,
  title,
  highlight,
  illustration,
}) {
  const resolvedHeadingTop = headingTop ?? title ?? "";
  const resolvedHeadingHighlight = headingHighlight ?? highlight ?? "";
  const theme = CARD_THEMES[step] ?? CARD_THEMES["05"];
  const copy = CARD_COPY[step] ?? CARD_COPY["05"];
  const isEven = Number(step) % 2 === 0;

  return (
    <article
      className="relative flex h-full w-full overflow-hidden rounded-[16px]"
      style={{
        background: theme.leftPanelBg,
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
        minHeight: "480px",
        flexDirection: isEven ? "row-reverse" : "row",
      }}
    >
      {/* Corner number badge — always top-right of the card */}
      <CornerNumberBadge step={step} theme={theme} />

      <TextColumn
        step={step}
        headingTop={resolvedHeadingTop}
        headingHighlight={resolvedHeadingHighlight}
        copy={copy}
        theme={theme}
      />
      <VisualColumn
        illustration={illustration}
        theme={theme}
      />
    </article>
  );
}
