export default function Dashboard() {
  const quickLinks = ['Configure your GitHub', 'Read Documentation', 'Create a System', 'Provision a System']
  const filters = ['Distributed', 'Microservice', 'Monolithic']
  const recommendations = [
    { audience: 'For Beginners & Startups', tier: 'Basic', users: '100-500' },
    { audience: 'For Freelancers and Mid-Sized companies', tier: 'Intermediate', users: '1k-10k' },
    { audience: 'For Big-Tech', tier: 'Advanced', users: '50k+' },
  ]

  return (
    <div className='space-y-6 text-[#F5F5F5]'>
      <header className='flex items-start justify-between'>
        <div className='space-y-1'>
          {quickLinks.map((link) => (
            <button
              key={link}
              type='button'
              className='block text-left text-sm font-semibold text-orange-500 underline underline-offset-2'
            >
              {link}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-4'>
          <h1 className='text-3xl font-semibold'>Hello, XYZ</h1>
          <button
            type='button'
            className='grid h-10 w-10 place-items-center rounded-full border border-[#2A2A2A] bg-[#1A1A1A] text-sm font-semibold text-[#F5F5F5]'
          >
            P
          </button>
        </div>
      </header>

      <section className='space-y-4'>
        <div>
          <h2 className='text-5xl font-semibold leading-tight'>Get started with popular templates for you system...</h2>
          <p className='mt-2 text-sm text-[#737373]'>7 results</p>
        </div>

        <div className='flex flex-wrap gap-3'>
          {filters.map((filter) => (
            <button
              key={filter}
              type='button'
              className='rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold text-[#F5F5F5] hover:border-orange-500 hover:text-orange-500'
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className='overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='grid grid-cols-[1.8fr_0.8fr_0.8fr_0.7fr] border-b border-[#2A2A2A]'>
          <p className='px-4 py-3 text-sm font-semibold text-[#737373]'> </p>
          <p className='border-l border-[#2A2A2A] px-4 py-3 text-sm font-semibold text-[#F5F5F5]'>Tier</p>
          <p className='border-l border-[#2A2A2A] px-4 py-3 text-sm font-semibold text-[#F5F5F5]'>Users</p>
          <p className='border-l border-[#2A2A2A] px-4 py-3 text-sm font-semibold text-[#737373]'> </p>
        </div>

        {recommendations.map((item) => (
          <div key={item.audience} className='grid grid-cols-[1.8fr_0.8fr_0.8fr_0.7fr] border-b border-[#2A2A2A] last:border-b-0'>
            <p className='px-4 py-4 text-xl font-semibold'>{item.audience}</p>
            <p className='border-l border-[#2A2A2A] px-4 py-4 text-lg font-semibold'>{item.tier}</p>
            <p className='border-l border-[#2A2A2A] px-4 py-4 text-lg font-semibold'>{item.users}</p>
            <div className='border-l border-[#2A2A2A] px-4 py-4'>
              <button
                type='button'
                className='w-full rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-[#F5F5F5] hover:bg-orange-600'
              >
                Use
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
