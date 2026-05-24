import { useState } from 'react'
import { useParams } from 'react-router-dom'

const steps = [
  { title: 'Project Details', text: 'Set the basic project name, visibility, and description.' },
  { title: 'Tech Stack', text: 'Choose your framework, runtime, and deployment region.' },
  { title: 'Review & Create', text: 'Review all settings and create your project.' },
]

export default function ProjectWizard() {
  const { id } = useParams()
  const [step, setStep] = useState(1)

  const current = steps[step - 1]
  const isFirst = step === 1
  const isLast = step === steps.length

  return (
    <div>
      <h1 className='text-3xl font-bold'>Project Wizard {id ? `(${id})` : ''}</h1>

      <div className='mt-6 grid gap-3 md:grid-cols-3'>
        {steps.map((item, index) => {
          const number = index + 1
          const active = step === number
          return (
            <div
              key={item.title}
              className={`rounded-lg border p-3 ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`}
            >
              <p className='text-xs font-semibold uppercase text-slate-500'>Step {number}</p>
              <p className='font-semibold'>{item.title}</p>
            </div>
          )
        })}
      </div>

      <section className='mt-6 rounded-xl border border-slate-200 p-5'>
        <h2 className='text-xl font-semibold'>{current.title}</h2>
        <p className='mt-2 text-slate-600'>{current.text}</p>
      </section>

      <div className='mt-6 flex gap-3'>
        <button
          type='button'
          disabled={isFirst}
          onClick={() => setStep((prev) => Math.max(1, prev - 1))}
          className='rounded-md border border-slate-300 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50'
        >
          Back
        </button>

        <button
          type='button'
          disabled={isLast}
          onClick={() => setStep((prev) => Math.min(steps.length, prev + 1))}
          className='rounded-md bg-sky-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50'
        >
          Next
        </button>
      </div>
    </div>
  )
}
