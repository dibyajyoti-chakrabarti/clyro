import { Link, useParams } from 'react-router-dom'

const nodeLibrary = ['EC2', 'RDS', 'S3', 'VPC', 'API Gateway', 'EventBridge', 'Queue']

export default function ArchitectureCanvas() {
  const { id } = useParams()

  return (
    <div className='space-y-4 text-[#F5F5F5]'>
      <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 shadow-[0_0_0_1px_#2A2A2A]'>
        <p className='font-semibold'>Architectural canvas</p>
        <div className='flex flex-wrap gap-2'>
          <button type='button' className='rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1 text-sm hover:border-orange-500 hover:text-orange-500'>
            Save Design state
          </button>
          <button type='button' className='rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1 text-sm hover:border-orange-500 hover:text-orange-500'>
            Share
          </button>
          <button type='button' className='rounded-md bg-orange-500 px-3 py-1 text-sm font-semibold text-[#F5F5F5] hover:bg-orange-600'>
            Validate Design
          </button>
        </div>
      </div>

      <div className='grid gap-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 shadow-[0_0_0_1px_#2A2A2A] lg:grid-cols-[170px_1fr_250px]'>
        <aside className='rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-3'>
          <p className='mb-2 text-sm font-semibold text-[#737373]'>Components</p>
          <ul className='space-y-2 text-sm'>
            {nodeLibrary.map((item) => (
              <li key={item} className='rounded-md border border-[#2A2A2A] px-2 py-1'>
                {item}
              </li>
            ))}
          </ul>
        </aside>

        <section className='min-h-[420px] rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-4'>
          <div className='relative h-full min-h-[380px]'>
            <div className='absolute left-[15%] top-[20%] rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-6 py-3 font-semibold'>EC2</div>
            <div className='absolute left-[43%] top-[20%] rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-6 py-3 font-semibold'>S3</div>
            <div className='absolute left-[18%] top-[42%] rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-6 py-3 font-semibold'>RDS</div>
          </div>
        </section>

        <aside className='flex min-h-[420px] flex-col rounded-lg border border-[#2A2A2A] bg-[#0E0E0E]'>
          <div className='border-b border-[#2A2A2A] px-3 py-2'>
            <p className='font-semibold'>AI Assistant</p>
          </div>
          <div className='flex-1 space-y-3 px-3 py-3 text-sm text-[#737373]'>
            <p>Hey I am here to help you.</p>
            <p>Prompt suggestions:</p>
            <p>Help me create...</p>
            <p>Complete this architecture</p>
          </div>
          <div className='border-t border-[#2A2A2A] p-2'>
            <input
              type='text'
              placeholder='Ask about this...'
              className='w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-[#F5F5F5] placeholder-[#737373] focus:outline-none focus:ring-1 focus:ring-orange-500'
            />
          </div>
        </aside>
      </div>

      <div className='flex flex-wrap items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex gap-2'>
          <button type='button' className='rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1 text-sm hover:border-orange-500 hover:text-orange-500'>
            Undo
          </button>
          <button type='button' className='rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1 text-sm hover:border-orange-500 hover:text-orange-500'>
            Redo
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <button type='button' className='rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1 text-sm'>
            -
          </button>
          <p className='text-sm text-[#737373]'>100%</p>
          <button type='button' className='rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-1 text-sm'>
            +
          </button>
        </div>
      </div>

      <Link
        to={id ? `/app/projects/${id}` : '/app/projects'}
        className='inline-flex rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold hover:border-orange-500 hover:text-orange-500'
      >
        Back to Wizard
      </Link>
    </div>
  )
}
