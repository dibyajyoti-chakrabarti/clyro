import { PenTool, BarChart3, Rocket } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Design",
    icon: PenTool,
    description:
      "Drag and drop cloud services or describe your system in plain English on a visual canvas.",
  },
  {
    number: "2",
    title: "Validate",
    icon: BarChart3,
    description:
      "Clyro analyzes your architecture for cost, security, and deployment readiness in real time.",
  },
  {
    number: "3",
    title: "Deploy",
    icon: Rocket,
    description:
      "Deploy your infrastructure to AWS with one click and no manual configuration.",
  },
];

export default function HowItWorks() {
  return (
    <section className="w-full bg-background py-12 text-text-primary lg:py-14">
      <div className="mx-auto w-full max-w-[1700px] px-4 sm:px-6 lg:px-10 xl:px-12">
        <h2 className="text-center text-3xl font-semibold tracking-normal text-text-primary sm:text-4xl">
          How Clyro Works
        </h2>

        <div className="mt-8 grid gap-6 md:grid-cols-3 lg:gap-8">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.title}
                className="rounded-2xl border border-white/[0.08] bg-surface/40 p-6 text-center shadow-sm"
              >
                <div className="mx-auto flex size-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black shadow-[0_8px_20px_rgba(251,191,36,0.18)]">
                  {step.number}
                </div>

                <div className="mx-auto mt-3 flex size-20 items-center justify-center rounded-lg border border-white/[0.08] bg-surface/40 text-amber-300">
                  <Icon className="h-9 w-9 text-amber-300" />
                </div>

                <h3 className="mt-3 text-lg font-semibold text-text-primary">
                  {step.title}
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-muted">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
