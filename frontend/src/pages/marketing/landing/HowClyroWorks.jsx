const steps = [
  {
    title: 'Describe Your Idea',
    body: 'Tell Clyro what you want to build in plain language.',
  },
  {
    title: 'AI Designs Architecture',
    body: 'Clyro generates a secure, scalable architecture tailored to your needs.',
  },
  {
    title: 'Review & Customize',
    body: 'Review the architecture, get AI recommendations, and customize if needed.',
  },
  {
    title: 'One-Click Deploy',
    body: 'Clyro provisions all AWS resources automatically and securely.',
  },
  {
    title: 'Monitor & Optimize',
    body: 'Monitor performance, costs, and security. Clyro keeps your infra optimized.',
  },
]

export default function HowClyroWorks() {
  return (
    <section
      id='how-it-works'
      className='relative -mt-10 bg-marketing-gold-pale px-5 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-14 lg:pt-24'
    >
      <div className='mx-auto w-full max-w-[1240px]'>
        <h2 className='text-center text-[2rem] font-bold tracking-tight text-marketing-bronze-dark lg:text-[2.75rem]'>
          How Clyro Works
        </h2>
        <p className='mx-auto mt-4 max-w-[36rem] text-center text-[1.375rem] leading-[1.6] text-marketing-bronze-dark/75'>
          Go from an idea to a fully provisioned cloud environment in minutes.
        </p>

        <ol className='mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4'>
          {steps.map((step, index) => (
            <li key={step.title} className='relative flex'>
              <div className='relative flex flex-1 flex-col rounded-2xl bg-marketing-cream-2 p-5 shadow-md'>
                <span className='absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-full bg-black text-[0.8rem] font-bold text-white'>
                  {index + 1}
                </span>

                <div
                  className='mx-auto flex h-[104px] w-full items-center justify-center rounded-xl'
                  style={{
                    backgroundColor: '#E5E5E5',
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 10px)',
                  }}
                >
                  <span className='text-[0.7rem] font-medium uppercase tracking-wide text-gray-500'>
                    placeholder
                  </span>
                </div>

                <h3 className='mt-5 text-[1rem] font-bold text-marketing-near-black'>{step.title}</h3>
                <p className='mt-2 text-[0.85rem] leading-[1.6] text-[#6B665C]'>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
