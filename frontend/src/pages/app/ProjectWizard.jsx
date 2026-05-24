import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const totalSteps = 4

export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()
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

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex items-center justify-between border-b border-[#2A2A2A] bg-[#0E0E0E] px-5 py-3'>
          <p className='text-sm font-semibold uppercase tracking-wide text-[#737373]'>
            <span className='mr-2 text-orange-500'>•</span>Step 1: Source code
          </p>
        </div>
        <div className='space-y-5 p-5'>
          <p className='text-[#737373]'>Connect your repository so Clyro can understand your codebase.</p>

          <div className='grid gap-3 md:grid-cols-3'>
            {['GitHub', 'GitLab', 'Bitbucket'].map((provider) => (
              <button
                key={provider}
                type='button'
                className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-5 text-center font-semibold hover:border-orange-500'
              >
                {provider}
              </button>
            ))}
          </div>

          <p className='text-center text-sm text-[#737373]'>or use a URL</p>

          <div className='flex flex-wrap gap-3'>
            <input
              type='text'
              placeholder='https://github.com/your-org/your-repo'
              className='min-w-[260px] flex-1 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-[#F5F5F5] placeholder-[#737373] focus:outline-none focus:ring-1 focus:ring-orange-500'
            />
            <button type='button' className='rounded-xl bg-orange-500 px-5 py-2 font-semibold text-[#F5F5F5] hover:bg-orange-600'>
              Connect
            </button>
          </div>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex items-center justify-between border-b border-[#2A2A2A] bg-[#0E0E0E] px-5 py-3'>
          <p className='text-sm font-semibold uppercase tracking-wide text-[#737373]'>
            <span className='mr-2 text-orange-500'>•</span>Step 2: Architecture
          </p>
          <span className='rounded-full border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1 text-xs font-semibold text-[#737373]'>
            Step 1 complete — 4 services detected
          </span>
        </div>
        <div className='space-y-5 p-5'>
          <p className='text-[#737373]'>How do you want to provide your architecture?</p>
          <div className='flex flex-wrap gap-3'>
            {['Existing canvas', 'Upload image', 'Draw on canvas'].map((item) => (
              <button
                key={item}
                type='button'
                onClick={() => {
                  if (item === 'Draw on canvas' && id) {
                    navigate(`/app/projects/${id}/canvas`)
                  }
                }}
                className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 font-semibold hover:border-orange-500'
              >
                {item}
              </button>
            ))}
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <select className='min-w-[260px] flex-1 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-[#F5F5F5] focus:outline-none focus:ring-1 focus:ring-orange-500'>
              <option>acme-corp — production-v2 (last edited 3 days ago)</option>
            </select>
            <button type='button' className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-5 py-2 font-semibold hover:border-orange-500'>
              Load
            </button>
          </div>

          <div className='rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-6 text-center text-[#737373]'>
            Select a canvas above to preview
          </div>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex items-center justify-between border-b border-[#2A2A2A] bg-[#0E0E0E] px-5 py-3'>
          <p className='text-sm font-semibold uppercase tracking-wide text-[#737373]'>
            <span className='mr-2 text-orange-500'>•</span>Step 3: Map codebase to architecture
          </p>
          <div className='flex items-center gap-2 text-xs'>
            <span className='rounded-full border border-[#2A2A2A] bg-[#1A1A1A] px-2 py-1 text-orange-500'>3 mapped</span>
            <span className='rounded-full border border-red-500/40 bg-[#1A1A1A] px-2 py-1 text-red-500'>1 unresolved</span>
          </div>
        </div>
        <div className='space-y-5 p-5'>
          <p className='text-[#737373]'>
            Clyro auto-mapped your code to your architecture nodes. Review and fix anything that looks off.
          </p>

          <div className='grid gap-4 rounded-xl border border-[#2A2A2A] p-4 lg:grid-cols-2'>
            <div className='rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-4'>
              <p className='mb-3 text-sm font-semibold text-[#737373]'>Architecture Nodes</p>
              <div className='space-y-2'>
                {[
                  ['API Gateway', 'entry point', 'Mapped'],
                  ['Worker service', 'background jobs', 'Mapped'],
                  ['Frontend', 'Next.js app', 'Mapped'],
                  ['Data pipeline', 'ETL service', 'Unresolved'],
                ].map(([name, desc, status]) => (
                  <div key={name} className='flex items-center justify-between rounded-lg border border-[#2A2A2A] px-3 py-2'>
                    <div>
                      <p className='font-semibold'>{name}</p>
                      <p className='text-xs text-[#737373]'>{desc}</p>
                    </div>
                    <span className={status === 'Mapped' ? 'text-xs font-semibold text-orange-500' : 'text-xs font-semibold text-red-500'}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className='rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-4'>
              <p className='mb-3 text-sm font-semibold text-[#737373]'>Code Modules</p>
              <div className='space-y-2'>
                {['/cmd/api', '/cmd/worker', '/apps/web'].map((module) => (
                  <div key={module} className='rounded-lg border border-[#2A2A2A] px-3 py-2'>
                    <p className='font-semibold'>{module}</p>
                  </div>
                ))}
                <div className='rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-[#737373]'>No match found • Drag module to link</div>
              </div>
            </div>
          </div>

          <div className='rounded-xl border border-red-500/40 bg-[#0E0E0E] p-3 text-sm text-[#737373]'>
            Data pipeline is unresolved. You may need to link it manually or confirm it is an external service.
          </div>

          <div className='flex items-center justify-between'>
            <button type='button' className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 font-semibold hover:border-orange-500'>
              Back to Step 2
            </button>
            <button type='button' className='rounded-xl bg-orange-500 px-5 py-2 font-semibold text-[#F5F5F5] hover:bg-orange-600'>
              Confirm mapping
            </button>
          </div>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex items-center justify-between border-b border-[#2A2A2A] bg-[#0E0E0E] px-5 py-3'>
          <p className='text-sm font-semibold uppercase tracking-wide text-[#737373]'>
            <span className='mr-2 text-orange-500'>•</span>Step 4: AI Clarification
          </p>
        </div>
        <div className='space-y-5 p-5'>
          <div className='rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-4'>
            <p className='font-semibold'>Clyro has analysed your system</p>
            <p className='text-sm text-[#737373]'>API Backend · AWS · {'<$50/mo'} · Solo · Priority: Cost efficiency</p>
          </div>

          <div className='space-y-3'>
            <p className='font-semibold text-[#737373]'>2 QUESTIONS BEFORE PROVISIONING</p>

            <div className='rounded-xl border border-[#2A2A2A] p-4'>
              <p className='font-semibold'>1. Your data pipeline node isn&apos;t linked to code. Is it an external service?</p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {[`Yes, it's Fivetran`, `No, I'll add the code`, 'Skip for now'].map((choice) => (
                  <button key={choice} type='button' className='rounded-xl border border-[#2A2A2A] px-3 py-2 hover:border-orange-500'>
                    {choice}
                  </button>
                ))}
              </div>
            </div>

            <div className='rounded-xl border border-[#2A2A2A] p-4'>
              <p className='font-semibold'>2. Should the API be publicly accessible or private (VPC only)?</p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {['Public', 'Private (VPC only)'].map((choice) => (
                  <button key={choice} type='button' className='rounded-xl border border-[#2A2A2A] px-3 py-2 hover:border-orange-500'>
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className='rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-4'>
            <p className='mb-3 font-semibold'>Provision summary</p>
            <div className='grid gap-3 md:grid-cols-3'>
              <div>
                <p className='text-sm text-[#737373]'>Resources</p>
                <p className='text-4xl font-semibold'>12</p>
              </div>
              <div>
                <p className='text-sm text-[#737373]'>Est. cost</p>
                <p className='text-4xl font-semibold'>$34/mo</p>
              </div>
              <div>
                <p className='text-sm text-[#737373]'>Region</p>
                <p className='text-4xl font-semibold'>ap-south-1</p>
              </div>
            </div>
          </div>

          <div className='flex justify-end'>
            <button type='button' className='rounded-xl bg-orange-500 px-6 py-3 font-semibold text-[#F5F5F5] hover:bg-orange-600'>
              Provision
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
