import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

const tiers = [
  { name: 'Free', price: '$0', details: 'For solo builders exploring Clyro.', cta: 'Choose Free' },
  { name: 'Pro', price: '$29/mo', details: 'For teams shipping multiple services.', cta: 'Choose Pro', featured: true },
  { name: 'Enterprise', price: 'Custom', details: 'For regulated and large-scale orgs.', cta: 'Contact Sales' },
]

export default function Pricing() {
  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-semibold tracking-tight'>Pricing</h1>
      <div className='grid gap-4 md:grid-cols-3'>
        {tiers.map((tier) => (
          <Card key={tier.name} className={tier.featured ? 'border-accent' : ''}>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-semibold'>{tier.name}</h2>
              {tier.featured ? <Badge variant='warning'>Most Popular</Badge> : null}
            </div>
            <p className='mt-4 text-2xl font-semibold tracking-tight'>{tier.price}</p>
            <p className='mt-2 text-sm font-normal text-text-muted'>{tier.details}</p>
            <Button variant={tier.featured ? 'primary' : 'secondary'} className='mt-5 w-full'>
              {tier.cta}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
