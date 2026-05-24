import { useState } from 'react'
import { useParams } from 'react-router-dom'

const totalSteps = 4

export default function ProjectWizard() {
  const { id } = useParams()
  const [step, setStep] = useState(0)

  const isFirst = step === 0
  const isLast = step === totalSteps - 1
  const projectName = id ? `Project ${id.toUpperCase?.() ?? id}` : 'Project ABC'

  return (
    <div className='space-y-5 text-[#F5F5F5]'>
      <h1 className='text-6xl font-semibold'>{projectName}</h1>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex items-center justify-between border-b border-[#2A2A2A] bg-[#0E0E0E] px-5 py-3'>
          <p className='text-sm font-semibold uppercase tracking-wide text-[#737373]'>
            <span className='mr-2 text-orange-500'>•</span>Step 0: Use case discovery
          </p>
          <div className='flex gap-2'>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${index === step ? 'bg-[#F5F5F5]' : 'bg-[#737373]'}`}
              />
            ))}
          </div>
        </div>

        <div className='space-y-6 p-5'>
          {step === 0 && (
            <div className='space-y-4'>
              <div>
                <h2 className='text-2xl font-semibold'>What are you building?</h2>
                <p className='text-[#737373]'>Pick the closest match, you can refine later.</p>
              </div>
              <div className='grid gap-3 md:grid-cols-3'>
                {[
                  ['API backend', 'REST or GraphQL service'],
                  ['Full-stack web app', 'Frontend + backend'],
                  ['Microservices', 'Multiple services'],
                  ['Data pipeline', 'ETL / streaming'],
                  ['ML inference', 'Model serving'],
                  ['Internal tool', 'Admin / ops'],
                ].map(([title, text]) => (
                  <button
                    key={title}
                    type='button'
                    className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-left hover:border-orange-500'
                  >
                    <p className='font-semibold'>{title}</p>
                    <p className='text-sm text-[#737373]'>{text}</p>
                  </button>
                ))}
              </div>
              <p className='text-sm text-[#737373]'>Screen 1 of 4</p>
            </div>
          )}

          {step === 1 && (
            <div className='space-y-5'>
              <div>
                <h2 className='text-2xl font-semibold'>What stage is this project?</h2>
                <p className='text-[#737373]'>This shapes how Clyro sets defaults.</p>
              </div>
              <div className='space-y-3'>
                {[
                  ['New project from scratch', 'Nothing deployed yet'],
                  ['Migrating existing infra', 'Moving from somewhere else'],
                  ['Scaling something live', 'Already in production'],
                ].map(([title, text]) => (
                  <button
                    key={title}
                    type='button'
                    className='block w-full rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-left hover:border-orange-500'
                  >
                    <p className='font-semibold'>{title}</p>
                    <p className='text-sm text-[#737373]'>{text}</p>
                  </button>
                ))}
              </div>
              <div>
                <p className='mb-2 font-semibold'>Team size</p>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                  {['Solo', '2-5', '6-20', '20+'].map((size) => (
                    <button
                      key={size}
                      type='button'
                      className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 font-semibold hover:border-orange-500'
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className='space-y-5'>
              <div>
                <h2 className='text-2xl font-semibold'>Scale & cloud preferences</h2>
                <p className='text-[#737373]'>Helps Clyro choose the right services and regions.</p>
              </div>
              <div>
                <p className='mb-2 font-semibold'>Expected traffic</p>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                  {['Hobby', '<10k/day', '10k-1M', '1M+'].map((item) => (
                    <button key={item} type='button' className='rounded-xl border border-[#2A2A2A] px-4 py-2 hover:border-orange-500'>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className='mb-2 font-semibold'>Target cloud</p>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                  {['AWS', 'GCP', 'Azure', 'Recommend'].map((item) => (
                    <button key={item} type='button' className='rounded-xl border border-[#2A2A2A] px-4 py-2 hover:border-orange-500'>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className='mb-2 font-semibold'>Monthly budget</p>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                  {['<$50', '$50-$500', '$500-$5k', 'Uncapped'].map((item) => (
                    <button key={item} type='button' className='rounded-xl border border-[#2A2A2A] px-4 py-2 hover:border-orange-500'>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className='space-y-5'>
              <div>
                <h2 className='text-2xl font-semibold'>Compliance & priorities</h2>
                <p className='text-[#737373]'>Last step, helps Clyro apply the right guardrails.</p>
              </div>
              <div>
                <p className='mb-2 font-semibold'>Sensitive data handled?</p>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                  {['PII', 'Payments', 'Health', 'None'].map((item) => (
                    <button key={item} type='button' className='rounded-xl border border-[#2A2A2A] px-4 py-2 hover:border-orange-500'>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className='font-semibold'>Rank your priorities</p>
                <p className='mb-2 text-sm text-[#737373]'>Drag to reorder, top is most important</p>
                <div className='space-y-2 rounded-xl border border-[#2A2A2A] p-2'>
                  {['Cost efficiency', 'Security hardening', 'High availability', 'Fast provisioning', 'Developer simplicity'].map(
                    (item) => (
                      <div key={item} className='rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 font-semibold'>
                        {item}
                      </div>
                    ),
                  )}
                </div>
              </div>
              <div className='rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-3'>
                <p className='text-sm font-semibold text-orange-500'>Project intent card preview</p>
                <p className='text-sm text-[#737373]'>API Backend · AWS · Early stage · solo · {'<$50/mo'} · Priority: Cost</p>
              </div>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <button
              type='button'
              disabled={isFirst}
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 font-semibold text-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40'
            >
              Back
            </button>

            <button
              type='button'
              onClick={() => {
                if (!isLast) {
                  setStep((prev) => Math.min(totalSteps - 1, prev + 1))
                }
              }}
              className='rounded-xl bg-orange-500 px-4 py-2 font-semibold text-[#F5F5F5] hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {isLast ? 'Start building' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
