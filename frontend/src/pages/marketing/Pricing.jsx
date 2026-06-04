import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For solo builders exploring Clyro.',
    cta: 'Get started free',
    ctaTo: '/signup',
    ctaVariant: 'secondary',
    features: [
      'Up to 3 projects',
      'Unlimited repo scans',
      'ECS Fargate deployments',
      'PostgreSQL + Redis provisioning',
      'S3 + CloudFront for frontends',
      'Community support',
      'No credit card required',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For teams shipping multiple services.',
    cta: 'Start free trial',
    ctaTo: '/signup',
    ctaVariant: 'primary',
    featured: true,
    features: [
      'Unlimited projects',
      'Everything in Free',
      'Multi-region deployments',
      'Aurora PostgreSQL support',
      'Custom domain + ACM certificates',
      'Up to 5 team members',
      'Deployment audit logs',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For regulated and large-scale organisations.',
    cta: 'Contact us',
    ctaHref: 'mailto:hello@clyro.io',
    ctaVariant: 'secondary',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Custom AWS account structure',
      'SSO / SAML',
      'SLA guarantee',
      'Dedicated onboarding',
      'Dedicated support channel',
      'Custom contract',
    ],
  },
]

function Check() {
  return <i className='ti ti-check mt-px text-sm text-green-400 shrink-0' />
}

function TierCard({ tier }) {
  const content = (
    <div
      className={`flex h-full flex-col rounded-2xl border p-7 ${
        tier.featured
          ? 'border-accent bg-accent/5'
          : 'border-border bg-surface'
      }`}
    >
      {tier.featured && (
        <div className='mb-4 w-fit rounded-full border border-accent/40 bg-accent/10 px-3 py-0.5 text-xs font-semibold text-accent'>
          Most popular
        </div>
      )}

      <h2 className='text-xl font-semibold text-text-primary'>{tier.name}</h2>

      <div className='mt-4 flex items-baseline gap-1'>
        <span className='text-4xl font-semibold tracking-tight text-text-primary'>{tier.price}</span>
        {tier.period && <span className='text-sm text-text-muted'>{tier.period}</span>}
      </div>

      <p className='mt-2 text-sm text-text-muted'>{tier.description}</p>

      <ul className='mt-6 flex-1 space-y-2.5'>
        {tier.features.map((f) => (
          <li key={f} className='flex items-start gap-2.5 text-sm text-text-primary'>
            <Check />
            {f}
          </li>
        ))}
      </ul>

      <div className='mt-8'>
        {tier.ctaHref ? (
          <a href={tier.ctaHref}>
            <Button variant={tier.ctaVariant} className='w-full'>{tier.cta}</Button>
          </a>
        ) : (
          <Link to={tier.ctaTo}>
            <Button variant={tier.ctaVariant} className='w-full'>{tier.cta}</Button>
          </Link>
        )}
      </div>
    </div>
  )

  return content
}

export default function Pricing() {
  return (
    <div className='mx-auto max-w-5xl space-y-10 py-6'>
      <div className='text-center'>
        <h1 className='text-4xl font-semibold tracking-tight'>Simple, transparent pricing</h1>
        <p className='mt-3 text-base text-text-muted'>
          Start free. Scale when you need it. No surprise bills from Clyro — only from AWS.
        </p>
      </div>

      <div className='grid gap-6 md:grid-cols-3'>
        {TIERS.map((tier) => <TierCard key={tier.name} tier={tier} />)}
      </div>

      <div className='rounded-xl border border-border bg-surface p-6 text-center'>
        <p className='text-sm font-semibold text-text-primary'>All plans deploy to your own AWS account</p>
        <p className='mt-1 text-sm text-text-muted'>
          Clyro never holds your infrastructure. You retain full control and pay AWS directly for resources.
        </p>
      </div>
    </div>
  )
}
