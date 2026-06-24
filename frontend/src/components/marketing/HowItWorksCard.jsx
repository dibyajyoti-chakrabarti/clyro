import {
  Layers,
  Server,
  Database,
  Zap,
  Settings,
  BarChart2,
  Terminal,
  Globe,
  TrendingUp,
  GitBranch,
  Share2,
  Package,
  DollarSign,
  Sliders,
  Cloud,
  Cpu,
  Shield,
  GitMerge,
  Rocket,
  Activity,
  PieChart,
  CreditCard,
  Lightbulb,
  Sparkles,
} from "lucide-react";

const ICON_MAP = {
  Layers, Server, Database, Zap, Settings,
  BarChart2, Terminal, Globe, TrendingUp,
  GitBranch, Share2, Package, DollarSign, Sliders,
  Cloud, Cpu, Shield, GitMerge, Rocket,
  Activity, PieChart, CreditCard, Lightbulb,
};

const CARD_THEMES = {
  "01": {
    background: "linear-gradient(135deg, #F4E4B2 0%, #DDB24B 100%)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)",
    headingColor: "#1C1917",
    highlightColor: "#D97706",
    stepNumBg: "#1C1200",
    stepNumBorder: "rgba(245,158,11,0.30)",
  },
  "02": {
    background: "linear-gradient(135deg, #E2BC58 0%, #C89227 100%)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.10)",
    headingColor: "#1C1917",
    highlightColor: "#D97706",
    stepNumBg: "#1A1000",
    stepNumBorder: "rgba(245,158,11,0.30)",
  },
  "03": {
    background: "linear-gradient(135deg, #3B2800 0%, #2D1F00 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.28), 0 6px 16px rgba(0,0,0,0.16)",
    headingColor: "#FFFFFF",
    highlightColor: "#F59E0B",
    stepNumBg: "#0F0900",
    stepNumBorder: "rgba(245,158,11,0.25)",
  },
  "04": {
    background: "linear-gradient(135deg, #060D1F 0%, #0A0F1E 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.32), 0 6px 16px rgba(0,0,0,0.18)",
    headingColor: "#FFFFFF",
    highlightColor: "#F59E0B",
    stepNumBg: "#060810",
    stepNumBorder: "rgba(245,158,11,0.25)",
  },
  "05": {
    background: "linear-gradient(135deg, #0D1117 0%, #111827 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.36), 0 6px 16px rgba(0,0,0,0.20)",
    headingColor: "#FFFFFF",
    highlightColor: "#F59E0B",
    stepNumBg: "#080A10",
    stepNumBorder: "rgba(245,158,11,0.25)",
  },
};

const CARD_COPY = {
  "01": {
    summary: "Analyze your codebase and identify the services required for deployment.",
    chips: ["React Frontend", "Django Backend", "PostgreSQL", "Redis", "Celery Workers"],
    accentLabel: "Repository Scan Ready",
    ctaMain: "We scan. You deploy.",
    ctaSub: "No guesswork, just clarity.",
    icons: ["Layers", "Server", "Database", "Zap", "Settings"],
  },
  "02": {
    summary: "Understand your infrastructure goals before generating the architecture.",
    chips: ["Traffic Expectations", "Environment Setup", "Domain Selection", "Database Choice", "Scaling Requirements"],
    accentLabel: "Intent Capture",
    ctaMain: "Your goals. Our blueprint.",
    ctaSub: "Clarity before complexity.",
    icons: ["BarChart2", "Terminal", "Globe", "Database", "TrendingUp"],
  },
  "03": {
    summary: "Create an optimized deployment blueprint based on your application needs.",
    chips: ["Architecture Graph", "Service Mapping", "Resource Planning", "Cost Projection", "Optimization Rules"],
    accentLabel: "Blueprint Generated",
    ctaMain: "Infrastructure mapped.",
    ctaSub: "Optimized before it's built.",
    icons: ["GitBranch", "Share2", "Package", "DollarSign", "Sliders"],
  },
  "04": {
    summary: "Provision cloud resources and launch your architecture automatically.",
    chips: ["Cloud Resources", "Infrastructure Provisioning", "Security Policies", "Deployment Pipeline", "Production Launch"],
    accentLabel: "Deployment In Motion",
    ctaMain: "One click. Full stack.",
    ctaSub: "Live in minutes, not days.",
    icons: ["Cloud", "Cpu", "Shield", "GitMerge", "Rocket"],
  },
  "05": {
    summary: "Track performance, health, and cloud spend in one place.",
    chips: ["Health Monitoring", "Usage Analytics", "Cost Tracking", "Performance Insights", "Optimization Recommendations"],
    accentLabel: "Operations Live",
    ctaMain: "Always on. Always optimized.",
    ctaSub: "Ship with confidence.",
    icons: ["Activity", "PieChart", "CreditCard", "BarChart2", "Lightbulb"],
  },
};

function FeatureCard({ label, iconName, isLightCard }) {
  const Icon = ICON_MAP[iconName];
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 border overflow-hidden w-full"
      style={{
        background: isLightCard ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.08)",
        borderColor: isLightCard ? "rgba(214,211,209,1)" : "rgba(255,255,255,0.10)",
        boxSizing: "border-box",
      }}
    >
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: isLightCard ? "rgba(251,191,36,0.20)" : "rgba(245,158,11,0.20)",
        }}
      >
        {Icon ? (
          <Icon
            size={13}
            style={{ color: isLightCard ? "#B45309" : "#FCD34D" }}
            strokeWidth={2}
          />
        ) : (
          <div className="w-3 h-3 rounded bg-amber-400/30" />
        )}
      </div>
      <span
        className="text-xs font-medium leading-tight"
        style={{
          color: isLightCard ? "#1C1917" : "rgba(255,255,255,0.90)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function StatusCard({ label, isLightCard }) {
  return (
    <div
      className="flex-1 h-full flex flex-col justify-center rounded-2xl px-4 py-3 border"
      style={{
        background: isLightCard ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.08)",
        borderColor: isLightCard ? "rgba(214,211,209,1)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <span
          className="text-[10px] tracking-widest uppercase font-medium"
          style={{ color: isLightCard ? "rgba(120,113,108,1)" : "rgba(255,255,255,0.40)" }}
        >
          Status
        </span>
      </div>
      <span
        className="text-sm font-semibold leading-snug"
        style={{ color: isLightCard ? "#1C1917" : "#FFFFFF" }}
      >
        {label}
      </span>
    </div>
  );
}

function StepNumberCard({ step, theme }) {
  return (
    <div
      className="flex-shrink-0 w-[100px] h-full flex items-center justify-center rounded-2xl border"
      style={{
        background: theme.stepNumBg,
        borderColor: theme.stepNumBorder,
      }}
    >
      <span
        className="text-5xl xl:text-6xl font-black leading-none"
        style={{ color: "#F59E0B" }}
      >
        {step}
      </span>
    </div>
  );
}

function IllustrationCard({ illustration, isLightCard }) {
  return (
    <div
      className="flex-1 min-h-0 flex items-center justify-center rounded-2xl border overflow-hidden"
      style={{
        background: isLightCard ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.05)",
        borderColor: isLightCard ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.10)",
        backdropFilter: isLightCard ? "blur(8px)" : undefined,
      }}
    >
      <img
        src={illustration}
        alt=""
        className="block select-none object-contain pointer-events-none"
        style={{ maxWidth: "85%", maxHeight: "85%", width: "auto", height: "auto" }}
        draggable={false}
      />
    </div>
  );
}

function CtaTaglineRow({ main, sub, isLightCard }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3 border mt-auto flex-shrink-0"
      style={{
        background: isLightCard ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.10)",
        borderColor: isLightCard ? "rgba(214,211,209,1)" : "rgba(255,255,255,0.15)",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(245,158,11,0.20)" }}
      >
        <Sparkles size={16} style={{ color: "#F59E0B" }} strokeWidth={2} />
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className="text-sm font-semibold leading-snug"
          style={{ color: isLightCard ? "#1C1917" : "#FFFFFF" }}
        >
          {main}
        </span>
        <span
          className="text-xs leading-snug"
          style={{ color: isLightCard ? "rgba(120,113,108,1)" : "rgba(255,255,255,0.50)" }}
        >
          {sub}
        </span>
      </div>
    </div>
  );
}

function TextColumn({ step, headingTop, headingHighlight, copy, theme, isLightCard }) {
  return (
    <div className="w-full h-full lg:w-[42%] lg:flex-shrink-0">
      <div
        className="h-full flex flex-col rounded-2xl p-5 lg:p-6 overflow-hidden"
        style={{
          background: isLightCard ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.04)",
          border: isLightCard ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
          backdropFilter: isLightCard ? "blur(8px)" : undefined,
          boxSizing: "border-box",
        }}
      >
        {/* All content except CTA — flex-shrink-0 so it doesn't compress */}
        <div className="flex flex-col gap-3 flex-shrink-0">
          {/* Step badge */}
          <span
            className="w-fit px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase border"
            style={{
              background: "rgba(245,158,11,0.15)",
              color: "#F59E0B",
              borderColor: "rgba(245,158,11,0.30)",
            }}
          >
            STEP {step}
          </span>

          {/* Heading */}
          <h3
            className="font-black uppercase leading-tight text-3xl lg:text-3xl xl:text-4xl"
            style={{ color: theme.headingColor }}
          >
            {headingTop}{" "}
            <span style={{ color: theme.highlightColor }}>{headingHighlight}</span>
          </h3>

          {/* Description */}
          <p
            className="text-sm leading-relaxed"
            style={{ color: isLightCard ? "rgba(17,17,17,0.72)" : "rgba(255,255,255,0.60)" }}
          >
            {copy.summary}
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {copy.chips.map((chip, i) => (
              <FeatureCard
                key={chip}
                label={chip}
                iconName={copy.icons[i]}
                isLightCard={isLightCard}
              />
            ))}
          </div>
        </div>

        {/* CTA — pinned to bottom via mt-auto */}
        <CtaTaglineRow main={copy.ctaMain} sub={copy.ctaSub} isLightCard={isLightCard} />
      </div>
    </div>
  );
}

function VisualColumn({ step, copy, illustration, isLightCard, isEven, theme }) {
  return (
    // hidden on mobile, flex on lg+
    <div className="hidden lg:flex flex-col flex-1 min-w-0 h-full gap-3">
      {/* Top row: status card + step number card */}
      <div className="flex flex-row gap-3 flex-shrink-0 h-[88px]">
        {isEven ? (
          <>
            <StepNumberCard step={step} theme={theme} />
            <StatusCard label={copy.accentLabel} isLightCard={isLightCard} />
          </>
        ) : (
          <>
            <StatusCard label={copy.accentLabel} isLightCard={isLightCard} />
            <StepNumberCard step={step} theme={theme} />
          </>
        )}
      </div>
      {/* Illustration card — takes remaining height */}
      <IllustrationCard illustration={illustration} isLightCard={isLightCard} />
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
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px]
                 p-4 md:p-6 lg:p-6 xl:p-8"
      style={{
        background: theme.background,
        border: theme.border,
        boxShadow: theme.boxShadow,
      }}
    >
      <div className="w-full max-w-[1400px] mx-auto h-full">
        <div
          className={`flex h-full gap-4 flex-col ${
            isEven ? "lg:flex-row-reverse" : "lg:flex-row"
          }`}
        >
          <TextColumn
            step={step}
            headingTop={resolvedHeadingTop}
            headingHighlight={resolvedHeadingHighlight}
            copy={copy}
            theme={theme}
            isLightCard={isLightCard}
          />
          <VisualColumn
            step={step}
            copy={copy}
            illustration={illustration}
            isLightCard={isLightCard}
            isEven={isEven}
            theme={theme}
          />
        </div>
      </div>
    </article>
  );
}
