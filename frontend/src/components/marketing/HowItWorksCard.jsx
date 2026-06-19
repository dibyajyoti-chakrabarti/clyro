const CARD_THEMES = {
  "01": {
    background:
      "linear-gradient(135deg, #FCF2D2 0%, #F3D67D 55%, #D7A640 100%)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)",
    headingColor: "#101418",
    highlightColor: "#000000",
    stepBg: "#101418",
    stepColor: "#F7B500",
    stepShadow: "0 0 20px rgba(0,0,0,0.15)",
  },
  "02": {
    background:
      "linear-gradient(135deg, #F6D87C 0%, #D8A73B 55%, #A87518 100%)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)",
    headingColor: "#101418",
    highlightColor: "#000000",
    stepBg: "#101418",
    stepColor: "#F7B500",
    stepShadow: "0 0 20px rgba(0,0,0,0.15)",
  },
  "03": {
    background:
      "linear-gradient(135deg, #6A5222 0%, #4B3718 40%, #1D1813 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.28), 0 6px 16px rgba(0,0,0,0.16)",
    headingColor: "#FFFFFF",
    highlightColor: "#F7B500",
    stepBg: "#F7B500",
    stepColor: "#FFFFFF",
    stepShadow: "0 0 20px rgba(247,181,0,0.22)",
  },
  "04": {
    background:
      "linear-gradient(135deg, #0A1322 0%, #132238 55%, #2D1C07 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.32), 0 6px 16px rgba(0,0,0,0.18)",
    headingColor: "#FFFFFF",
    highlightColor: "#F7B500",
    stepBg: "#F7B500",
    stepColor: "#FFFFFF",
    stepShadow: "0 0 20px rgba(247,181,0,0.22)",
  },
  "05": {
    background:
      "linear-gradient(135deg, #04070D 0%, #0B1728 55%, #2B1A06 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.36), 0 6px 16px rgba(0,0,0,0.20)",
    headingColor: "#FFFFFF",
    highlightColor: "#F7B500",
    stepBg: "#F7B500",
    stepColor: "#FFFFFF",
    stepShadow: "0 0 20px rgba(247,181,0,0.22)",
  },
};

export default function HowItWorksCard({
  step,
  headingTop,
  headingHighlight,
  title,
  highlight,
  illustration,
  accent,
}) {
  const resolvedHeadingTop = headingTop ?? title ?? "";
  const resolvedHeadingHighlight = headingHighlight ?? highlight ?? "";

  const theme = CARD_THEMES[step] ?? CARD_THEMES["05"];

  const fullHeading =
    `${resolvedHeadingTop} ${resolvedHeadingHighlight}`.trim();
  const words = fullHeading.split(/\s+/).filter(Boolean);

  return (
    <article
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px]"
      style={{
        padding: "24px",
        background: theme.background,
        border: theme.border,
        boxShadow: theme.boxShadow,
      }}
    >
      {/* Step badge */}
      <div
        className="absolute right-[20px] top-[20px] z-[20] flex h-[56px] w-[56px] items-center justify-center rounded-full text-[28px] font-extrabold md:right-[28px] md:top-[28px] md:h-[72px] md:w-[72px] md:text-[36px] lg:right-[32px] lg:top-[32px] lg:h-[96px] lg:w-[96px] lg:text-[48px]"
        style={{
          background: theme.stepBg,
          color: theme.stepColor,
          boxShadow: theme.stepShadow,
        }}
      >
        {step}
      </div>

      {/* Heading */}
      <div className="z-[10] flex-shrink-0 pr-24 pt-7 lg:pr-32">
        <h3
          className="font-extrabold uppercase leading-[1.05] tracking-[-0.02em]"
          style={{
            fontSize: "clamp(28px, 3.2vw, 56px)",
            wordSpacing: "0.12em",
            whiteSpace: "normal",
            overflowWrap: "break-word",
            color: theme.headingColor,
          }}
        >
          {words.map((word, index) => {
            const isHighlighted = word === resolvedHeadingHighlight;
            return (
              <span
                key={`${word}-${index}`}
                className="inline-block"
                style={{
                  marginRight: index === words.length - 1 ? 0 : "0.2em",
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
      </div>

      {/* Illustration */}
      <div
        className="hidden md:flex flex-1 w-full items-end justify-center overflow-hidden px-6 pb-4 pt-4"
        style={{ position: "relative", zIndex: 1 }}
      >
        <img
          src={illustration}
          alt=""
          className="block h-full w-full object-contain select-none pointer-events-none"
          style={{ objectPosition: "center bottom" }}
          draggable={false}
        />
      </div>
    </article>
  );
}
