import { ChevronRight } from 'lucide-react'

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
    <section id='how-it-works' className='bg-marketing-dark px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
      <div className='mx-auto w-full max-w-[1240px]'>
        <h2 className='text-center text-[2rem] font-bold tracking-tight text-marketing-ink lg:text-[2.75rem]'>
          How <span className='text-marketing-amber'>Clyro</span> Works
        </h2>
        <p className='mx-auto mt-4 max-w-[36rem] text-center text-[1.375rem] leading-[1.6] text-marketing-muted'>
          Go from an idea to a fully provisioned cloud environment in minutes.
        </p>

        <ol className='mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4'>
          {steps.map((step, index) => (
            <li key={step.title} className='relative flex'>
              <div className='relative flex flex-1 flex-col rounded-2xl border border-black/[0.07] bg-[#FDF6ED] p-5'>
                <span className='absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-lg bg-marketing-amber text-[0.8rem] font-bold text-white shadow-[0_2px_6px_rgba(244,196,48,0.4)]'>
                  {index + 1}
                </span>

                <div className='mx-auto flex h-[104px] w-full items-center justify-center rounded-xl border border-black/[0.06] bg-[#F5EBDA]'>
                  <span className='text-[0.7rem] font-medium uppercase tracking-wide text-[#6B665C]'>
                    placeholder
                  </span>
                </div>

                <h3 className='mt-5 text-[1rem] font-bold text-[#0B0B0B]'>{step.title}</h3>
                <p className='mt-2 text-[0.85rem] leading-[1.6] text-[#6B665C]'>{step.body}</p>
              </div>

              {index < steps.length - 1 ? (
                <span
                  className='absolute -right-[26px] top-1/2 z-10 hidden -translate-y-1/2 text-marketing-muted lg:block'
                  aria-hidden='true'
                >
                  <ChevronRight size={18} strokeWidth={2} />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
