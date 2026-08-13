import step1 from '../../../assets/landing_page/step1-ill.webp'
import step2 from '../../../assets/landing_page/step2-ill.webp'
import step3 from '../../../assets/landing_page/step3-ill.webp'
import step4 from '../../../assets/landing_page/step4-ill.webp'
import step5 from '../../../assets/landing_page/step5-ill.webp'

const steps = [
  {
    title: 'Describe',
    body: 'Describe your application in simple terms. Clyro understands your requirements.',
    image: step1,
  },
  {
    title: 'Generate',
    body: 'AI generates a production-ready AWS architecture tailored to your needs.',
    image: step2,
  },
  {
    title: 'Review',
    body: 'Review the architecture, cost estimates, and best practice insights.',
    image: step3,
  },
  {
    title: 'Deploy',
    body: 'Deploy with a click. Clyro provisions your infrastructure securely.',
    image: step4,
  },
  {
    title: 'Monitor',
    body: 'Monitor performance, costs, and health. Stay in control always.',
    image: step5,
  },
]

export default function HowClyroWorks() {
  return (
    <section id='how-it-works' className='bg-[#FDF6ED] px-5 pb-20 sm:px-6 lg:px-8 lg:pb-28'>
      <div className='mx-auto w-full max-w-[1240px] rounded-2xl border border-black/[0.06] bg-[#FBF3E6] px-5 py-12 sm:px-8 lg:px-10 lg:py-14'>
        <h2 className='text-center text-[1.75rem] font-bold tracking-[-0.02em] text-[#0B0B0B] sm:text-[2.1rem]'>
          How <span className='text-[#E8A33D]'>Clyro</span> Works
        </h2>

        <ol className='mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4'>
          {steps.map((step, index) => (
            <li
              key={step.title}
              className='relative flex flex-col rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
            >
              <span className='absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-lg bg-[#E8A33D] text-[0.8rem] font-bold text-white shadow-[0_2px_6px_rgba(232,163,61,0.4)]'>
                {index + 1}
              </span>

              <img
                src={step.image}
                alt=''
                aria-hidden='true'
                className='mx-auto h-[104px] w-auto object-contain'
              />

              <h3 className='mt-5 text-[1rem] font-bold text-[#0B0B0B]'>{step.title}</h3>
              <p className='mt-2 text-[0.8rem] leading-[1.6] text-[#6B665C]'>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
