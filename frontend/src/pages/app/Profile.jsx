const sections = [
  'General',
  'Payments',
  'Accounts & Security',
  'GitHub Integrations',
  'Deployments',
  'Billing & Payments',
  'Preferences',
  'Danger Zone',
]

const toId = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export default function Profile() {
  const scrollTo = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div>
      <h1 className='mb-6 text-3xl font-bold'>Profile</h1>
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]'>
        <nav className='lg:sticky lg:top-6 lg:h-fit'>
          <p className='mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500'>Bookmarks</p>
          <ul className='space-y-2'>
            {sections.map((section) => {
              const id = toId(section)
              return (
                <li key={section}>
                  <button
                    type='button'
                    onClick={() => scrollTo(id)}
                    className='w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-100'
                  >
                    {section}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className='space-y-4'>
          {sections.map((section) => (
            <section
              key={section}
              id={toId(section)}
              className='min-h-[260px] rounded-xl border border-slate-200 p-5 scroll-mt-6'
            >
              <h2 className='text-xl font-semibold'>{section}</h2>
              <p className='mt-2 text-slate-600'>Manage your {section.toLowerCase()} settings here.</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
