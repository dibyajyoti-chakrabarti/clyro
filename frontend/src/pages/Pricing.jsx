const tiers = [
  { name: 'Free', price: '$0', details: 'For individuals trying Clyro.' },
  { name: 'Pro', price: '$29/mo', details: 'For fast-moving product teams.' },
  { name: 'Enterprise', price: 'Custom', details: 'For large organizations with security needs.' },
]

export default function Pricing() {
  return (
    <div>
      <h1 className='mb-8 text-3xl font-bold'>Pricing</h1>
      <div className='grid gap-4 md:grid-cols-3'>
        {tiers.map((tier) => (
          <article key={tier.name} className='rounded-xl border border-slate-200 bg-white p-6'>
            <h2 className='text-xl font-semibold'>{tier.name}</h2>
            <p className='mt-2 text-2xl font-bold text-sky-700'>{tier.price}</p>
            <p className='mt-3 text-slate-600'>{tier.details}</p>
            <button
              type='button'
              className='mt-5 w-full rounded-md bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700'
            >
              Choose {tier.name}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
