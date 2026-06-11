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

  const accentGradients = {
    yellow: "linear-gradient(90deg, #FFD84D, #FFC400)",
    orange: "linear-gradient(90deg, #FFB84D, #FF8A00)",
    blue: "linear-gradient(90deg, #62A7FF, #2F80FF)",
    green: "linear-gradient(90deg, #6EF6A2, #3DDC84)",
  };

  const highlightBackground = accentGradients[accent] ?? accentGradients.yellow;

  // Full heading as one string, highlight word wrapped in a marker
  const fullHeading =
    `${resolvedHeadingTop} ${resolvedHeadingHighlight}`.trim();
  const words = fullHeading.split(/\s+/).filter(Boolean);

  return (
    <article
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px] border border-[rgba(255,196,0,0.55)] shadow-[0_25px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,196,0,0.05),0_0_0_1px_rgba(255,196,0,0.08),0_0_30px_rgba(255,196,0,0.08)] backdrop-blur-[18px]"
      style={{
        padding: "24px",
        background:
          "radial-gradient(circle at 50% 70%, rgba(255,196,0,0.04), transparent 60%), linear-gradient(180deg, rgba(10,18,34,0.92), rgba(3,8,18,0.95))",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {/* Step badge */}
      <div
        className="absolute right-[20px] top-[20px] z-[20] flex h-[56px] w-[56px] items-center justify-center rounded-full text-[28px] font-extrabold text-white md:right-[28px] md:top-[28px] md:h-[72px] md:w-[72px] md:text-[36px] lg:right-[32px] lg:top-[32px] lg:h-[96px] lg:w-[96px] lg:text-[48px]"
        style={{
          background: "linear-gradient(135deg, #FFD84D, #C88700)",
          boxShadow: "0 0 40px rgba(255,196,0,0.22)",
        }}
      >
        {step}
      </div>

      {/* Heading — single line preferred, wraps only if it truly can't fit */}
      <div className="z-[10] flex-shrink-0 pr-24 pt-7 lg:pr-32">
        <h3
          className="font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-white"
          style={{
            /*
                clamp: min 28px, preferred 3.2vw, max 56px.
                The browser will naturally keep it one line at larger sizes
                and wrap only when the viewport is too narrow.
              */
            fontSize: "clamp(28px, 3.2vw, 56px)",
            wordSpacing: "0.12em",
            whiteSpace: "normal", // allow wrap only when needed
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
                  <span
                    className="inline bg-gradient-to-r bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]"
                    style={{ backgroundImage: highlightBackground }}
                  >
                    {word}
                  </span>
                ) : (
                  word
                )}
              </span>
            );
          })}
        </h3>
      </div>

      {/* Illustration — takes all remaining space */}
      <div className="hidden md:flex flex-1 w-full items-end justify-center overflow-hidden px-6 pb-4 pt-4">
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
