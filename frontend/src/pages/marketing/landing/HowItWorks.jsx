const steps = [
  {
    number: '1',
    title: 'Design',
    icon: '□',
    description: 'Drag and drop cloud services or describe your system in plain English on a visual canvas.',
  },
  {
    number: '2',
    title: 'Validate',
    icon: '▥',
    description: 'Clyro analyzes your architecture for cost, security, and deployment readiness in real time.',
  },
  {
    number: '3',
    title: 'Deploy',
    icon: '△',
    description: 'Deploy your infrastructure to AWS with one click and no manual configuration.',
  },
]

export default function HowItWorks() {
  return (
    <section className='bg-background text-text-primary'>
      <div className='mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8'>
        <h2 className='text-center text-3xl font-semibold tracking-normal sm:text-4xl'>
          How Clyro Works
        </h2>

        <div className='mt-12 grid gap-12 md:grid-cols-3 md:gap-16'>
          {steps.map((step, index) => (
            <div key={step.title} className='relative text-center'>
              {index < steps.length - 1 ? (
                <div className='absolute left-[calc(50%+4.75rem)] top-16 hidden w-[calc(100%-9.5rem)] items-center md:flex' aria-hidden='true'>
                  <span className='h-px flex-1 bg-white/[0.16]' />
                  <span className='ml-3 text-xl leading-none text-text-muted'>→</span>
                </div>
              ) : null}

              <div className='mx-auto flex size-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black shadow-[0_8px_20px_rgba(251,191,36,0.18)]'>
                {step.number}
              </div>
              <div className='mx-auto mt-4 flex size-24 items-center justify-center rounded-lg border border-white/[0.14] bg-surface/45 text-3xl font-semibold text-amber-300'>
                {step.icon}
              </div>
              <h3 className='mt-4 text-lg font-semibold text-text-primary'>{step.title}</h3>
              <p className='mx-auto mt-2 max-w-[15rem] text-sm leading-6 text-text-muted'>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
