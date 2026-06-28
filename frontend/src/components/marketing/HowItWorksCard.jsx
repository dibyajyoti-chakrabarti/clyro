import { Sparkles } from "lucide-react";

const CARD_THEMES = {
  "01": {
    cardBorder: "1px solid rgba(255,255,255,0.08)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overlayGradient: "linear-gradient(to right, #E8D5A3 0%, #E8D5A3 38%, transparent 72%, transparent 100%)",
    headingColor: "#1A1200",
    highlightColor: "#7A5C00",
    bodyTextColor: "#2C2100",
    bodyMutedColor: "rgba(44, 33, 0, 0.75)",
    taglineMain: "#1A1200",
    taglineSub: "rgba(44, 33, 0, 0.6)",
    taglineBorderColor: "rgba(0, 0, 0, 0.12)",
    taglineIcon: "#7A5C00",
    chipBorder: "rgba(0, 0, 0, 0.12)",
    numBg: "rgba(255,255,255,0.3)",
    numText: "#5C3D00",
    pillBg: "rgba(0, 0, 0, 0.06)",
    pillBorder: "rgba(0, 0, 0, 0.15)",
    pillText: "rgba(0, 0, 0, 0.7)",
  },
  "02": {
    cardBorder: "1px solid rgba(255,255,255,0.08)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overlayGradient: "linear-gradient(to left, #B8A070 0%, #B8A070 38%, transparent 72%, transparent 100%)",
    headingColor: "#1A1200",
    highlightColor: "#7A5C00",
    bodyTextColor: "#2C2100",
    bodyMutedColor: "rgba(44, 33, 0, 0.75)",
    taglineMain: "#1A1200",
    taglineSub: "rgba(44, 33, 0, 0.6)",
    taglineBorderColor: "rgba(0, 0, 0, 0.12)",
    taglineIcon: "#7A5C00",
    chipBorder: "rgba(0, 0, 0, 0.12)",
    numBg: "rgba(255,255,255,0.3)",
    numText: "#5C3D00",
    pillBg: "rgba(0, 0, 0, 0.06)",
    pillBorder: "rgba(0, 0, 0, 0.15)",
    pillText: "rgba(0, 0, 0, 0.7)",
  },
  "03": {
    cardBorder: "1px solid rgba(255,255,255,0.08)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overlayGradient: "linear-gradient(to right, #6B5020 0%, #6B5020 38%, transparent 72%, transparent 100%)",
    headingColor: "#FFFFFF",
    highlightColor: "#C9A84C",
    bodyTextColor: "#FFFFFF",
    bodyMutedColor: "rgba(255,255,255,0.8)",
    taglineMain: "#FFFFFF",
    taglineSub: "rgba(255,255,255,0.65)",
    taglineBorderColor: "rgba(255,255,255,0.15)",
    taglineIcon: "#C9A84C",
    chipBorder: "rgba(255,255,255,0.12)",
    numBg: "rgba(0,0,0,0.55)",
    numText: "#C9A84C",
    pillBg: "rgba(255,255,255,0.08)",
    pillBorder: "rgba(255,255,255,0.3)",
    pillText: "rgba(255,255,255,0.85)",
  },
  "04": {
    cardBorder: "1px solid rgba(255,255,255,0.06)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overlayGradient: "linear-gradient(to left, #2A1C08 0%, #2A1C08 38%, transparent 72%, transparent 100%)",
    headingColor: "#FFFFFF",
    highlightColor: "#C9A84C",
    bodyTextColor: "#FFFFFF",
    bodyMutedColor: "rgba(255,255,255,0.8)",
    taglineMain: "#FFFFFF",
    taglineSub: "rgba(255,255,255,0.65)",
    taglineBorderColor: "rgba(255,255,255,0.15)",
    taglineIcon: "#C9A84C",
    chipBorder: "rgba(255,255,255,0.09)",
    numBg: "rgba(0,0,0,0.55)",
    numText: "#C9A84C",
    pillBg: "rgba(255,255,255,0.08)",
    pillBorder: "rgba(255,255,255,0.3)",
    pillText: "rgba(255,255,255,0.85)",
  },
  "05": {
    cardBorder: "1px solid rgba(255,255,255,0.04)",
    cardShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overlayGradient: "linear-gradient(to right, #0D0900 0%, #0D0900 38%, transparent 72%, transparent 100%)",
    headingColor: "#FFFFFF",
    highlightColor: "#C9A84C",
    bodyTextColor: "#FFFFFF",
    bodyMutedColor: "rgba(255,255,255,0.8)",
    taglineMain: "#FFFFFF",
    taglineSub: "rgba(255,255,255,0.65)",
    taglineBorderColor: "rgba(255,255,255,0.15)",
    taglineIcon: "#C9A84C",
    chipBorder: "rgba(255,255,255,0.07)",
    numBg: "rgba(0,0,0,0.55)",
    numText: "#C9A84C",
    pillBg: "rgba(255,255,255,0.08)",
    pillBorder: "rgba(255,255,255,0.3)",
    pillText: "rgba(255,255,255,0.85)",
  },
};

const CARD_COPY = {
  "01": {
    summary: "Analyze your codebase and identify the services required for deployment.",
    detail: "Our engine scans your repo structure, detects frameworks, languages, and dependencies — then maps every service that needs to be provisioned. No manual config files. No guesswork.",
    ctaMain: "We scan. You deploy.",
    ctaSub: "No guesswork, just clarity.",
    pills: ["Auto-detect", "Zero config", "Multi-language"],
  },
  "02": {
    summary: "Understand your infrastructure goals before generating the architecture.",
    detail: "Tell us your deployment goals — scalability, cost-efficiency, high availability — and we translate them into concrete infrastructure requirements before a single resource is spun up.",
    ctaMain: "Your goals. Our blueprint.",
    ctaSub: "Clarity before complexity.",
    pills: ["Goal-driven", "Intent mapping", "Pre-flight check"],
  },
  "03": {
    summary: "Create an optimized deployment blueprint based on your application needs.",
    detail: "We generate a production-grade architecture diagram tailored to your app, selecting the right services, regions, and configurations. Review and approve before anything is built.",
    ctaMain: "Infrastructure mapped.",
    ctaSub: "Optimized before it's built.",
    pills: ["Blueprint gen", "Region-aware", "Cost-optimized"],
  },
  "04": {
    summary: "Provision cloud resources and launch your architecture automatically.",
    detail: "With one click, we provision all your cloud resources — load balancers, databases, compute, networking — fully automated. Your stack goes live in minutes, not days.",
    ctaMain: "One click. Full stack.",
    ctaSub: "Live in minutes, not days.",
    pills: ["One-click deploy", "Full stack", "Auto-provisioned"],
  },
  "05": {
    summary: "Track performance, health, and cloud spend in one place.",
    detail: "Get real-time visibility into uptime, latency, and cloud costs. We surface anomalies and optimization opportunities so your infrastructure stays healthy and cost-efficient.",
    ctaMain: "Always on. Always optimized.",
    ctaSub: "Ship with confidence.",
    pills: ["Live metrics", "Spend tracking", "Auto-optimize"],
  },
};

function CornerNumberBadge({ step, theme, isOdd }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        // odd → top-right, even → top-left
        ...(isOdd ? { right: 0 } : { left: 0 }),
        zIndex: 3,
        fontSize: "4rem",
        fontWeight: 800,
        lineHeight: 1,
        padding: "0.5rem 1rem",
        letterSpacing: "-0.02em",
        color: theme.numText,
        backgroundColor: theme.numBg,
        fontFamily: "inherit",
      }}
    >
      {step}
    </div>
  );
}

function TextColumn({ headingTop, headingHighlight, copy, theme, isEven }) {
  return (
    <div
      className="w-full lg:w-[52%] lg:flex-shrink-0 flex flex-col h-full"
      style={{
        paddingTop: "48px",
        paddingBottom: "48px",
        paddingLeft: isEven ? "24px" : "48px",
        paddingRight: isEven ? "48px" : "24px",
        maxWidth: "520px",
        ...(isEven ? { marginLeft: "auto" } : { marginRight: "auto" }),
        boxSizing: "border-box",
        position: "relative",
        zIndex: 2,
        textAlign: "left",
        gap: "1.25rem",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Heading */}
      <h3
        style={{
          color: theme.headingColor,
          fontWeight: 900,
          fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          fontFamily: "inherit",
          margin: 0,
          textShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        {headingTop}
        <br />
        <span style={{ color: theme.highlightColor, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
          {headingHighlight}
        </span>
      </h3>

      {/* Decorative sparkle */}
      <span style={{ color: theme.highlightColor, fontSize: "16px", opacity: 0.8, lineHeight: 1 }}>
        ✦
      </span>

      {/* Summary paragraph */}
      <p
        style={{
          color: theme.bodyTextColor,
          fontSize: "1.15rem",
          lineHeight: 1.7,
          fontWeight: 500,
          margin: 0,
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}
      >
        {copy.summary}
      </p>

      {/* Detail paragraph */}
      <p
        style={{
          color: theme.bodyMutedColor,
          fontSize: "0.95rem",
          lineHeight: 1.7,
          fontWeight: 400,
          margin: 0,
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}
      >
        {copy.detail}
      </p>

      {/* Feature pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {copy.pills.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.3rem 0.75rem",
              borderRadius: "999px",
              border: `1px solid ${theme.pillBorder}`,
              color: theme.pillText,
              backgroundColor: theme.pillBg,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Tagline — pushed to bottom */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginTop: "auto",
          paddingTop: "1.25rem",
          borderTop: `1px solid ${theme.taglineBorderColor}`,
        }}
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
          <p
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: theme.taglineMain,
              margin: 0,
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            {copy.ctaMain}
          </p>
          <p
            style={{
              fontSize: "0.8rem",
              fontWeight: 400,
              color: theme.taglineSub,
              margin: 0,
            }}
          >
            {copy.ctaSub}
          </p>
        </div>
      </div>
    </div>
  );
}

function VisualColumn() {
  return (
    <div
      className="hidden lg:block flex-1 min-w-0 h-full"
      style={{ position: "relative", zIndex: 2 }}
    />
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
        backgroundImage: `url(${illustration})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
        minHeight: "480px",
        flexDirection: isEven ? "row-reverse" : "row",
      }}
    >
      {/* Directional gradient overlay — opaque on text side, transparent on image side */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: theme.overlayGradient,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Corner number — odd: top-right, even: top-left */}
      <CornerNumberBadge step={step} theme={theme} isOdd={!isEven} />

      <TextColumn
        headingTop={resolvedHeadingTop}
        headingHighlight={resolvedHeadingHighlight}
        copy={copy}
        theme={theme}
        isEven={isEven}
      />
      <VisualColumn />
    </article>
  );
}
