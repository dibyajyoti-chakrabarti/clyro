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

function TierCard({ tier }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl p-6 transition-all duration-200 hover:-translate-y-px ${
        tier.featured
          ? 'border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-accent/[0.02] shadow-[0_0_40px_rgba(249,115,22,0.1)] ring-1 ring-accent/20'
          : 'border border-white/[0.08] bg-surface shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'
      }`}
    >
      {tier.featured && (
        <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
          <span className='rounded-full border border-accent/40 bg-accent/15 px-3 py-0.5 text-xs font-semibold text-accent shadow-[0_0_12px_rgba(249,115,22,0.2)]'>
            Most popular
          </span>
        </div>
      )}

      <div>
        <h2 className='text-base font-semibold'>{tier.name}</h2>
        <div className='mt-3 flex items-baseline gap-1'>
          <span className='text-4xl font-bold tracking-tight'>{tier.price}</span>
          {tier.period && <span className='text-sm text-text-muted'>{tier.period}</span>}
        </div>
        <p className='mt-1.5 text-sm text-text-muted'>{tier.description}</p>
      </div>

      <ul className='mt-6 flex-1 space-y-2.5'>
        {tier.features.map((f) => (
          <li key={f} className='flex items-start gap-2.5 text-sm'>
            <i className='ti ti-check mt-px shrink-0 text-green-400' />
            <span className='text-text-primary'>{f}</span>
          </li>
        ))}
      </ul>

      <div className='mt-8'>
        {tier.ctaHref ? (
          <a href={tier.ctaHref} className='block'>
            <Button variant={tier.ctaVariant} className='w-full'>{tier.cta}</Button>
          </a>
        ) : (
          <Link to={tier.ctaTo} className='block'>
            <Button variant={tier.ctaVariant} className='w-full'>{tier.cta}</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export default function Pricing() {
  return (
    <div className='mx-auto max-w-5xl space-y-10 py-8'>
      <div className='text-center'>
        <h1 className='text-4xl font-bold tracking-tight'>Simple, transparent pricing</h1>
        <p className='mt-3 text-base text-text-muted'>
          Start free. Scale when you need it. No surprise bills from Clyro, only from AWS.
        </p>
      </div>

      <div className='grid gap-5 pt-4 md:grid-cols-3'>
        {TIERS.map((tier) => <TierCard key={tier.name} tier={tier} />)}
      </div>

      <div className='flex items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-surface/50 px-6 py-4 text-center'>
        <i className='ti ti-shield-check text-lg text-green-400' />
        <div className='text-left'>
          <p className='text-sm font-semibold'>All plans deploy to your own AWS account</p>
          <p className='text-xs text-text-muted'>Clyro never holds your infrastructure. You retain full control and pay AWS directly.</p>
        </div>
      </div>
    </div>
  )
}
