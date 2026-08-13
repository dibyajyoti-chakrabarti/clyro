import { GraduationCap, PiggyBank, ShieldCheck, Timer, Users } from 'lucide-react'

const reasons = [
  { icon: Timer, title: 'Save Time', body: 'Go from idea to infrastructure in minutes, not hours.' },
  { icon: PiggyBank, title: 'Reduce Costs', body: 'Optimize architectures and avoid costly mistakes.' },
  {
    icon: ShieldCheck,
    title: 'Enterprise Ready',
    body: 'Built with security, scalability, and reliability in mind.',
  },
  { icon: Users, title: 'Collaborate Better', body: 'Share, review, and iterate with your team seamlessly.' },
  { icon: GraduationCap, title: 'Learn & Grow', body: 'Understand AWS better with AI-powered insights.' },
]

export default function WhyEngineers() {
  return (
    <section id='solutions' className='bg-[#FDF6ED] px-5 pb-20 sm:px-6 lg:px-8 lg:pb-28'>
      <div className='mx-auto w-full max-w-[1240px] rounded-2xl bg-[#EAF3EC] px-5 py-12 sm:px-8 lg:px-10 lg:py-14'>
        <h2 className='text-center text-[1.75rem] font-bold tracking-[-0.02em] text-[#0B0B0B] sm:text-[2.1rem]'>
          Why Engineers <span aria-label='love'>🧡</span> Clyro
        </h2>

        <ul className='mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          {reasons.map((reason) => (
            <li
              key={reason.title}
              className='rounded-2xl border border-black/[0.06] bg-white/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
            >
              <div className='flex items-center gap-2.5'>
                <span className='text-[#3F7D5C]'>
                  <reason.icon size={18} strokeWidth={1.9} />
                </span>
                <h3 className='text-[0.92rem] font-bold text-[#0B0B0B]'>{reason.title}</h3>
              </div>
              <p className='mt-2.5 text-[0.8rem] leading-[1.6] text-[#6B665C]'>{reason.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
