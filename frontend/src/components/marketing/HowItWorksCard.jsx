const CARD_THEMES = {
  "01": {
    background: "linear-gradient(90deg, #F4E4B2 0%, #DDB24B 100%)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)",
    headingColor: "#0B0B0B",
    highlightColor: "#FFB300",
    stepBg: "#06101D",
    stepColor: "#FFB300",
    stepShadow: "0 0 30px rgba(255,179,0,0.15)",
    titleColor: "rgba(17,17,17,0.45)",
    bodyColor: "rgba(17,17,17,0.72)",
    chipBg: "rgba(255,255,255,0.55)",
    chipText: "#111111",
    chipBorder: "rgba(0,0,0,0.06)",
    badgeBg: "rgba(255,255,255,0.20)",
    badgeBorder: "rgba(255,255,255,0.25)",
    badgeText: "rgba(0,0,0,0.75)",
    processText: "rgba(17,17,17,0.45)",
  },
  "02": {
    background: "linear-gradient(90deg, #E2BC58 0%, #C89227 100%)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)",
    headingColor: "#0B0B0B",
    highlightColor: "#FFB300",
    stepBg: "#06101D",
    stepColor: "#FFB300",
    stepShadow: "0 0 30px rgba(255,179,0,0.15)",
    titleColor: "rgba(17,17,17,0.45)",
    bodyColor: "rgba(17,17,17,0.72)",
    chipBg: "rgba(255,255,255,0.55)",
    chipText: "#111111",
    chipBorder: "rgba(0,0,0,0.06)",
    badgeBg: "rgba(255,255,255,0.20)",
    badgeBorder: "rgba(255,255,255,0.25)",
    badgeText: "rgba(0,0,0,0.75)",
    processText: "rgba(17,17,17,0.45)",
  },
  "03": {
    background: "linear-gradient(90deg, #6A4A16 0%, #1D1510 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.28), 0 6px 16px rgba(0,0,0,0.16)",
    headingColor: "#FFFFFF",
    highlightColor: "#FFB300",
    stepBg: "#06101D",
    stepColor: "#FFB300",
    stepShadow: "0 0 30px rgba(255,179,0,0.15)",
    titleColor: "rgba(255,255,255,0.45)",
    bodyColor: "rgba(255,255,255,0.72)",
    chipBg: "rgba(255,255,255,0.10)",
    chipText: "#FFFFFF",
    chipBorder: "rgba(255,255,255,0.08)",
    badgeBg: "rgba(255,255,255,0.08)",
    badgeBorder: "rgba(255,255,255,0.10)",
    badgeText: "rgba(255,255,255,0.90)",
    processText: "rgba(255,255,255,0.45)",
  },
  "04": {
    background: "linear-gradient(90deg, #03142F 0%, #1C1C1C 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.32), 0 6px 16px rgba(0,0,0,0.18)",
    headingColor: "#FFFFFF",
    highlightColor: "#FFB300",
    stepBg: "#06101D",
    stepColor: "#FFB300",
    stepShadow: "0 0 30px rgba(255,179,0,0.15)",
    titleColor: "rgba(255,255,255,0.45)",
    bodyColor: "rgba(255,255,255,0.72)",
    chipBg: "rgba(255,255,255,0.10)",
    chipText: "#FFFFFF",
    chipBorder: "rgba(255,255,255,0.08)",
    badgeBg: "rgba(255,255,255,0.08)",
    badgeBorder: "rgba(255,255,255,0.10)",
    badgeText: "rgba(255,255,255,0.90)",
    processText: "rgba(255,255,255,0.45)",
  },
  "05": {
    background: "linear-gradient(90deg, #02122B 0%, #1A1714 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.36), 0 6px 16px rgba(0,0,0,0.20)",
    headingColor: "#FFFFFF",
    highlightColor: "#FFB300",
    stepBg: "#06101D",
    stepColor: "#FFB300",
    stepShadow: "0 0 30px rgba(255,179,0,0.15)",
    titleColor: "rgba(255,255,255,0.45)",
    bodyColor: "rgba(255,255,255,0.72)",
    chipBg: "rgba(255,255,255,0.10)",
    chipText: "#FFFFFF",
    chipBorder: "rgba(255,255,255,0.08)",
    badgeBg: "rgba(255,255,255,0.08)",
    badgeBorder: "rgba(255,255,255,0.10)",
    badgeText: "rgba(255,255,255,0.90)",
    processText: "rgba(255,255,255,0.45)",
  },
};

const CARD_COPY = {
  "01": {
    summary:
      "Analyze your codebase and identify the services required for deployment.",
    chips: ["React Frontend", "Django Backend", "PostgreSQL", "Redis", "Celery Workers"],
    flow: ["Repository", "Analysis", "Detection", "Blueprint"],
    accentLabel: "Repository Scan Ready",
  },
  "02": {
    summary:
      "Understand your infrastructure goals before generating the architecture.",
    chips: [
      "Traffic Expectations",
      "Environment Setup",
      "Domain Selection",
      "Database Choice",
      "Scaling Requirements",
    ],
    flow: ["Requirements", "Validation", "Planning"],
    accentLabel: "Intent Capture",
  },
  "03": {
    summary:
      "Create an optimized deployment blueprint based on your application needs.",
    chips: [
      "Architecture Graph",
      "Service Mapping",
      "Resource Planning",
      "Cost Projection",
      "Optimization Rules",
    ],
    flow: ["Architecture", "Optimization", "Final Design"],
    accentLabel: "Blueprint Generated",
  },
  "04": {
    summary:
      "Provision cloud resources and launch your architecture automatically.",
    chips: [
      "Cloud Resources",
      "Infrastructure Provisioning",
      "Security Policies",
      "Deployment Pipeline",
      "Production Launch",
    ],
    flow: ["Provision", "Configure", "Deploy"],
    accentLabel: "Deployment In Motion",
  },
  "05": {
    summary: "Track performance, health, and cloud spend in one place.",
    chips: [
      "Health Monitoring",
      "Usage Analytics",
      "Cost Tracking",
      "Performance Insights",
      "Optimization Recommendations",
    ],
    flow: ["Monitor", "Analyze", "Optimize"],
    accentLabel: "Operations Live",
  },
};

function Chip({ children, variant = "dark" }) {
  const variantClasses =
    variant === "light"
      ? "bg-[rgba(255,255,255,0.55)] text-[#111111] border-[rgba(0,0,0,0.06)]"
      : "bg-[rgba(255,255,255,0.10)] text-white border-[rgba(255,255,255,0.08)]";

  return (
    <span
      className={`inline-flex h-[42px] items-center rounded-full border px-[18px] text-[15px] font-semibold tracking-normal transition-[filter] hover:brightness-105 ${variantClasses}`}
    >
      {children}
    </span>
  );
}

function StatusBadge({ children, variant = "dark" }) {
  const variantClasses =
    variant === "light"
      ? "bg-[rgba(255,255,255,0.20)] border-[rgba(255,255,255,0.25)] text-[rgba(0,0,0,0.75)]"
      : "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.90)]";

  return (
    <div
      className={`inline-flex h-[54px] w-[220px] items-center rounded-[18px] border px-5 backdrop-blur-[12px] ${variantClasses}`}
    >
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] opacity-90">
        Status
      </span>
      <span className="ml-2 text-[20px] font-bold leading-none">{children}</span>
    </div>
  );
}

function StepCircle({ step, theme }) {
  return (
    <div
      className="flex h-[120px] w-[120px] items-center justify-center rounded-full"
      style={{
        background: theme.stepBg,
        color: theme.stepColor,
        boxShadow: theme.stepShadow,
      }}
    >
      <span className="text-[56px] font-extrabold leading-none">{step}</span>
    </div>
  );
}

function ContentBlock({ step, headingTop, headingHighlight, copy, theme, isLightCard }) {
  const fullHeading = `${headingTop} ${headingHighlight}`.trim();
  const words = fullHeading.split(/\s+/).filter(Boolean);
  const chipVariant = step === "01" || step === "02" ? "light" : "dark";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <div>
          <p
            className="text-[14px] font-bold uppercase tracking-[0.25em]"
            style={{
              color: isLightCard ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.45)",
            }}
          >
            Step {step}
          </p>

          <h3
            className="mt-3 max-w-[80%] font-extrabold uppercase leading-[0.95] tracking-[-0.03em]"
            style={{
              fontSize: "56px",
              color: theme.headingColor,
            }}
          >
            {words.map((word, index) => {
              const isHighlighted = word === headingHighlight;
              return (
                <span
                  key={`${word}-${index}`}
                  className="inline-block"
                  style={{
                    marginRight: index === words.length - 1 ? 0 : "0.18em",
                  }}
                >
                  {isHighlighted ? (
                    <span style={{ color: theme.highlightColor }}>{word}</span>
                  ) : (
                    word
                  )}
                </span>
              );
            })}
          </h3>

          <p
            className="mt-6 max-w-[70%] text-[22px] font-normal leading-[1.5]"
            style={{
              color: isLightCard ? "rgba(17,17,17,0.72)" : "rgba(255,255,255,0.72)",
            }}
          >
            {copy.summary}
          </p>

          <div className="mt-8 flex max-w-[100%] flex-wrap gap-3">
            {copy.chips.map((chip) => (
              <Chip key={chip} variant={chipVariant}>
                {chip}
              </Chip>
            ))}
          </div>
        </div>

        <div
          className="mt-auto pt-8 text-[15px] font-bold uppercase tracking-[0.18em]"
          style={{
            color: isLightCard ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.45)",
            opacity: 0.55,
          }}
        >
          {copy.flow.map((item, index) => (
            <span key={item} className="inline-flex items-center">
              <span>{item}</span>
              {index < copy.flow.length - 1 ? <span className="mx-2">→</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function VisualBlock({ illustration }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-hidden">
      <img
        src={illustration}
        alt=""
        className="block select-none object-contain pointer-events-none"
        style={{
          width: "70%",
          maxWidth: "75%",
          maxHeight: "90%",
        }}
        draggable={false}
      />
    </div>
  );
}

function OddCardLayout({ step, headingTop, headingHighlight, illustration, theme, copy, isLightCard }) {
  return (
    <div
      className="grid h-full min-h-0 grid-rows-[120px_1fr] md:grid-rows-[120px_1fr]"
      style={{
        gridTemplateColumns: "56% 22% 22%",
        gridTemplateAreas: '"content status step" "content visual visual"',
      }}
    >
      <div className="md:[grid-area:content]">
        <ContentBlock
          step={step}
          headingTop={headingTop}
          headingHighlight={headingHighlight}
          copy={copy}
          theme={theme}
          isLightCard={isLightCard}
        />
      </div>
      <div className="flex items-center justify-center md:[grid-area:status]">
        <StatusBadge variant={isLightCard ? "light" : "dark"}>
          {copy.accentLabel}
        </StatusBadge>
      </div>
      <div className="flex items-center justify-center md:[grid-area:step]">
        <StepCircle step={step} theme={theme} />
      </div>
      <div className="md:[grid-area:visual]">
        <VisualBlock illustration={illustration} />
      </div>
    </div>
  );
}

function EvenCardLayout({ step, headingTop, headingHighlight, illustration, theme, copy, isLightCard }) {
  return (
    <div
      className="grid h-full min-h-0 grid-rows-[120px_1fr] md:grid-rows-[120px_1fr]"
      style={{
        gridTemplateColumns: "22% 22% 56%",
        gridTemplateAreas: '"step status content" "visual visual content"',
      }}
    >
      <div className="flex items-center justify-center md:[grid-area:step]">
        <StepCircle step={step} theme={theme} />
      </div>
      <div className="flex items-center justify-center md:[grid-area:status]">
        <StatusBadge variant={isLightCard ? "light" : "dark"}>
          {copy.accentLabel}
        </StatusBadge>
      </div>
      <div className="md:[grid-area:content]">
        <ContentBlock
          step={step}
          headingTop={headingTop}
          headingHighlight={headingHighlight}
          copy={copy}
          theme={theme}
          isLightCard={isLightCard}
        />
      </div>
      <div className="md:[grid-area:visual]">
        <VisualBlock illustration={illustration} />
      </div>
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
  const isLightCard = step === "01" || step === "02";
  const isEven = Number(step) % 2 === 0;

  return (
    <article
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px]"
      style={{
        padding: "32px",
        background: theme.background,
        border: theme.border,
        boxShadow: theme.boxShadow,
      }}
    >
      {isEven ? (
        <EvenCardLayout
          step={step}
          headingTop={resolvedHeadingTop}
          headingHighlight={resolvedHeadingHighlight}
          illustration={illustration}
          theme={theme}
          copy={copy}
          isLightCard={isLightCard}
        />
      ) : (
        <OddCardLayout
          step={step}
          headingTop={resolvedHeadingTop}
          headingHighlight={resolvedHeadingHighlight}
          illustration={illustration}
          theme={theme}
          copy={copy}
          isLightCard={isLightCard}
        />
      )}
    </article>
  );
}
