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

  const themes = {
    yellow: {
      background:
        "linear-gradient(135deg, #050B16 0%, #0E1D36 55%, #2A1B08 100%)",
      accentColor: "#F4C430",
      glowColor: "rgba(244,196,48,0.22)",
      borderColor: "rgba(244,196,48,0.18)",
      stepBg: "linear-gradient(135deg, #F4C430, #C88800)",
      stepShadow: "0 0 36px rgba(244,196,48,0.30)",
    },
    orange: {
      background: "linear-gradient(135deg, #150B0B 0%, #43201B 100%)",
      accentColor: "#E08A1E",
      glowColor: "rgba(224,138,30,0.25)",
      borderColor: "rgba(224,138,30,0.18)",
      stepBg: "linear-gradient(135deg, #E08A1E, #A85800)",
      stepShadow: "0 0 36px rgba(224,138,30,0.30)",
    },
    blue: {
      background: "linear-gradient(135deg, #081512 0%, #184034 100%)",
      accentColor: "#43B581",
      glowColor: "rgba(67,181,129,0.25)",
      borderColor: "rgba(67,181,129,0.18)",
      stepBg: "linear-gradient(135deg, #43B581, #1E7A52)",
      stepShadow: "0 0 36px rgba(67,181,129,0.30)",
    },
    green: {
      background: "linear-gradient(135deg, #0B1024 0%, #2A3475 100%)",
      accentColor: "#5DA9FF",
      glowColor: "rgba(93,169,255,0.25)",
      borderColor: "rgba(93,169,255,0.18)",
      stepBg: "linear-gradient(135deg, #5DA9FF, #2060C8)",
      stepShadow: "0 0 36px rgba(93,169,255,0.30)",
    },
    violet: {
      background:
        "linear-gradient(135deg, #030712 0%, #0F172A 45%, #134E4A 100%)",
      accentColor: "#4FD1C5",
      glowColor: "rgba(79,209,197,0.22)",
      borderColor: "rgba(79,209,197,0.18)",
      stepBg: "linear-gradient(135deg, #4FD1C5, #0E7C75)",
      stepShadow: "0 0 36px rgba(79,209,197,0.30)",
    },
  };

  const stepThemeMap = {
    "01": themes.yellow,
    "02": themes.orange,
    "03": themes.blue,
    "04": themes.green,
    "05": themes.violet,
  };

  const theme = stepThemeMap[step] ?? themes[accent] ?? themes.yellow;

  const fullHeading =
    `${resolvedHeadingTop} ${resolvedHeadingHighlight}`.trim();
  const words = fullHeading.split(/\s+/).filter(Boolean);

  return (
    <article
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px]"
      style={{
        padding: "24px",
        background: theme.background,
        border: `1px solid ${theme.borderColor}`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 ${theme.glowColor}`,
      }}
    >
      {/* Radial glow behind illustration */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 55% at 50% 80%, ${theme.glowColor}, transparent 70%)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Step badge */}
      <div
        className="absolute right-[20px] top-[20px] z-[20] flex h-[56px] w-[56px] items-center justify-center rounded-full text-[28px] font-extrabold text-white md:right-[28px] md:top-[28px] md:h-[72px] md:w-[72px] md:text-[36px] lg:right-[32px] lg:top-[32px] lg:h-[96px] lg:w-[96px] lg:text-[48px]"
        style={{
          background: theme.stepBg,
          boxShadow: theme.stepShadow,
        }}
      >
        {step}
      </div>

      {/* Heading */}
      <div className="z-[10] flex-shrink-0 pr-24 pt-7 lg:pr-32">
        <h3
          className="font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-white"
          style={{
            fontSize: "clamp(28px, 3.2vw, 56px)",
            wordSpacing: "0.12em",
            whiteSpace: "normal",
            overflowWrap: "break-word",
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
                  <span style={{ color: theme.accentColor }}>{word}</span>
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
