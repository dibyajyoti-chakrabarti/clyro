import { useState } from 'react'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    quote: 'Clyro turned our 3-day infra setup into a 10-minute process. Incredible!',
    name: 'Arjun Sharma',
    role: 'CTO, TechNova',
  },
  {
    quote: 'The AI recommendations helped us reduce costs by 37% right away.',
    name: 'Priya Nair',
    role: 'DevOps Engineer, FinMate',
  },
  {
    quote: 'Finally, an AI tool that understands AWS and developers.',
    name: 'Rohit Verma',
    role: 'Backend Engineer, LogiQ',
  },
]

function initialsOf(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
}

export default function WhyEngineers() {
  const [active, setActive] = useState(0)

  return (
    <section id='solutions' className='bg-marketing-dark px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
      <div className='mx-auto w-full max-w-[1240px]'>
        <h2 className='text-center text-[2rem] font-bold tracking-[-0.02em] text-marketing-ink lg:text-[2.75rem]'>
          Loved by <span className='text-marketing-amber'>Developers</span>
        </h2>

        <ul className='mt-10 grid gap-5 lg:grid-cols-3'>
          {testimonials.map((testimonial, index) => (
            <li
              key={testimonial.name}
              className={`flex-col rounded-2xl border border-white/10 bg-marketing-dark-surface p-6 ${
                index === active ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <Quote size={24} strokeWidth={1.8} className='text-marketing-amber' aria-hidden='true' />
              <p className='mt-4 text-[1rem] leading-[1.7] text-marketing-ink'>{testimonial.quote}</p>
              <div className='mt-6 flex items-center gap-3'>
                <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-marketing-amber-soft text-[0.75rem] font-bold text-marketing-amber'>
                  {initialsOf(testimonial.name)}
                </span>
                <div>
                  <p className='text-[1rem] font-semibold text-marketing-ink'>{testimonial.name}</p>
                  <p className='text-[0.85rem] text-marketing-muted'>{testimonial.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className='mt-8 flex items-center justify-center gap-2 lg:hidden'>
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.name}
              type='button'
              onClick={() => setActive(index)}
              aria-label={`Show testimonial from ${testimonial.name}`}
              aria-current={index === active}
              className={`size-2 rounded-full transition-colors ${
                index === active ? 'bg-marketing-amber' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
