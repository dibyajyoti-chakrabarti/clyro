import { BarChart3, ShieldCheck, Send, Unlock } from 'lucide-react'

const pillars = [
  {
    icon: Send,
    title: 'Simplicity First',
    body: 'We remove complexity so you can focus on building great products.',
    tint: 'bg-[#EDE8FB] text-[#6D4FD1]',
  },
  {
    icon: ShieldCheck,
    title: 'Security by Default',
    body: 'Best practices and security checks built into every step.',
    tint: 'bg-[#E4EEFC] text-[#2F6FD0]',
  },
  {
    icon: Unlock,
    title: 'Transparent & Open',
    body: 'No lock-in. Export, version, and manage everything your way.',
    tint: 'bg-[#F0E7FA] text-[#8250C4]',
  },
  {
    icon: BarChart3,
    title: 'Constantly Improving',
    body: 'We ship fast and listen to engineer feedback every day.',
    tint: 'bg-[#E3F3EA] text-[#2F8A5B]',
  },
]

export default function BuiltForEngineers() {
  return (
    <section id='company' className='bg-[#FDF6ED] px-5 pb-20 sm:px-6 lg:px-8 lg:pb-28'>
      <div className='mx-auto w-full max-w-[1240px] rounded-2xl bg-[#F1F1F7] px-5 py-12 sm:px-8 lg:px-10 lg:py-14'>
        <h2 className='text-center text-[1.75rem] font-bold tracking-[-0.02em] text-[#0B0B0B] sm:text-[2.1rem]'>
          Built for engineers, by engineers
        </h2>

        <ul className='mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {pillars.map((pillar) => (
            <li
              key={pillar.title}
              className='rounded-2xl border border-black/[0.05] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
            >
              <span className={`flex size-11 items-center justify-center rounded-xl ${pillar.tint}`}>
                <pillar.icon size={19} strokeWidth={1.8} />
              </span>
              <h3 className='mt-4 text-[0.95rem] font-bold text-[#0B0B0B]'>{pillar.title}</h3>
              <p className='mt-2 text-[0.8rem] leading-[1.65] text-[#6B665C]'>{pillar.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
