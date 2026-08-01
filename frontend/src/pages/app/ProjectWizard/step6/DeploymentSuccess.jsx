import { ArrowRight, CheckCircle2, Copy, Globe } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import ManageInfrastructurePanel from '../../../../components/projects/ManageInfrastructurePanel'
import { WizardPanel } from '../../../../components/wizard/WizardPanel'
import heroLeft from '../../../../assets/steps/step6/step6_left.webp'
import heroRight from '../../../../assets/steps/step6/step6_right.webp'
import s3Icon from '../../../../assets/steps/step6/Simple Storage Service.svg'
import snsIcon from '../../../../assets/steps/step6/Simple Notification Service.svg'
import rdsIcon from '../../../../assets/steps/step6/RDS.svg'
import elbIcon from '../../../../assets/steps/step6/aws-res-elastic-load-balancing-application-load-balancer.svg'
import queueIcon from '../../../../assets/steps/step6/ElastiCache.svg'
import logsIcon from '../../../../assets/steps/step6/CloudWatch.svg'

// The CloudFront output gets its own highlight bar above the grid; everything else
// is rendered as a resource card. Keyed by the CFN output key from cfn_generator.
const CLOUDFRONT_KEY = 'FrontendURL'

// Icon + badge tint per output key. `order` lays the grid out column-major
// (left: bucket / ALB / database — right: queue / SNS / logs) given `grid-cols-2`
// fills row by row.
const RESOURCE_META = {
  FrontendBucketName: { icon: s3Icon, badge: 'bg-green-500/15 ring-green-500/25', order: 0 },
  TaskQueueURL: { icon: queueIcon, badge: 'bg-pink-500/15 ring-pink-500/25', order: 1 },
  BackendURL: { icon: elbIcon, badge: 'bg-purple-500/15 ring-purple-500/25', order: 2 },
  AlertTopicArn: { icon: snsIcon, badge: 'bg-rose-500/15 ring-rose-500/25', order: 3 },
  DatabaseEndpoint: { icon: rdsIcon, badge: 'bg-blue-500/15 ring-blue-500/25', order: 4 },
  LogArchiveBucketName: { icon: logsIcon, badge: 'bg-teal-500/15 ring-teal-500/25', order: 5 },
}

const DEFAULT_META = { icon: s3Icon, badge: 'bg-white/[0.06] ring-white/[0.10]', order: 99 }

const NEXT_STEPS = [
  'Point your domain DNS to the CloudFront URL above',
  'Set up your CI/CD pipeline to push to ECR on merge to main',
  'Your architecture is saved and visible in the canvas',
]

const CARD = 'rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'

// Gentle warm highlight on hover, shared by every sub-card on this screen.
const CARD_HOVER =
  'transition-[box-shadow,border-color] duration-200 ease-out hover:border-amber-400/25 hover:shadow-[0_0_12px_rgba(245,166,35,0.25)]'

function ResourceCard({ output, copied, onCopy }) {
  const meta = RESOURCE_META[output.key] || DEFAULT_META
  return (
    <div className={`${CARD} ${CARD_HOVER} flex items-center gap-3 p-4`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${meta.badge}`}>
        <img src={meta.icon} alt='' aria-hidden='true' className='h-5 w-5' />
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-text-primary'>{output.description || output.key}</p>
        <p className='mt-0.5 break-all text-xs leading-relaxed text-text-muted line-clamp-2'>{output.value}</p>
      </div>
      <button
        type='button'
        className='flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-amber-400/40 hover:text-text-primary'
        onClick={() => onCopy(output.key, output.value)}
      >
        <Copy className='h-3.5 w-3.5' />
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function DeploymentSuccess({
  stackOutputs = [], copiedKey, onCopy, onGoToDashboard,
  deployStatus, infraActionLoading, infraActionError, onPause, onResume, onTeardown,
}) {
  const isDeleted = deployStatus === 'deleted'

  const cloudFront = stackOutputs.find((o) => o.key === CLOUDFRONT_KEY)
  const resources = stackOutputs
    .filter((o) => o.key !== CLOUDFRONT_KEY)
    .slice()
    .sort((a, b) => (RESOURCE_META[a.key] || DEFAULT_META).order - (RESOURCE_META[b.key] || DEFAULT_META).order)

  return (
    <WizardPanel>
      <div className='mx-auto w-full max-w-5xl space-y-6'>
        {/* Hero banner */}
        <div className='flex items-center justify-between gap-6 py-4'>
          <img
            src={heroLeft}
            alt=''
            aria-hidden='true'
            className='hidden w-[14rem] max-w-[30%] shrink select-none object-contain lg:block xl:w-[20rem]'
          />
          <div className='flex min-w-0 flex-1 flex-col items-center text-center'>
            <CheckCircle2 className='h-16 w-16 text-green-400' />
            <h3 className='mt-5 bg-gradient-to-r from-white via-[#FFD700] to-[#F5A623] bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl'>
              Your infrastructure is live
            </h3>
            <p className='mt-3 max-w-md text-sm text-text-muted'>
              Your infrastructure has been successfully provisioned and is ready to receive traffic.
            </p>
          </div>
          <img
            src={heroRight}
            alt=''
            aria-hidden='true'
            className='hidden w-[14rem] max-w-[30%] shrink select-none object-contain lg:block xl:w-[20rem]'
          />
        </div>

        {/* CloudFront URL highlight bar */}
        {cloudFront && (
          <div className={`${CARD_HOVER} flex flex-col gap-4 rounded-xl border border-amber-200/40 bg-[#FAF6EE] p-5 shadow-sm shadow-black/20 hover:border-amber-400/60 sm:flex-row sm:items-center sm:gap-5`}>
            <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black'>
              <Globe className='h-6 w-6' />
            </span>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-bold text-black'>{cloudFront.description || 'CloudFront URL'}</p>
              <a
                href={cloudFront.value}
                target='_blank'
                rel='noreferrer'
                className='mt-0.5 block break-all text-sm font-bold text-amber-600 underline-offset-4 hover:underline'
              >
                {cloudFront.value}
              </a>
              <p className='mt-2 text-xs leading-relaxed text-neutral-500'>
                This is the primary URL for your application. Share this link to access your app globally with low
                latency and high performance.
              </p>
            </div>
            <Button
              variant='primary'
              size='sm'
              className='shrink-0 self-start sm:self-center'
              onClick={() => onCopy(cloudFront.key, cloudFront.value)}
            >
              <Copy className='h-3.5 w-3.5' />
              {copiedKey === cloudFront.key ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        )}

        {/* Resource grid */}
        {stackOutputs.length === 0 ? (
          <p className={`${CARD} p-6 text-center text-sm text-text-muted`}>No stack outputs were returned.</p>
        ) : resources.length > 0 && (
          <div className='grid gap-4 md:grid-cols-2'>
            {resources.map((o) => (
              <ResourceCard key={o.key} output={o} copied={copiedKey === o.key} onCopy={onCopy} />
            ))}
          </div>
        )}

        {/* Next steps */}
        <div className={`${CARD} ${CARD_HOVER} p-6`}>
          <h4 className='text-sm font-semibold text-text-primary'>Next steps</h4>
          <div className='mt-5 grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07]'>
            {NEXT_STEPS.map((tip, i) => (
              <div key={tip} className='flex flex-col items-center gap-3 px-2 text-center sm:px-4'>
                <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-black'>
                  {i + 1}
                </span>
                <p className='text-sm leading-relaxed text-text-muted'>{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Manage infrastructure */}
        {!isDeleted && (
          <ManageInfrastructurePanel
            deployStatus={deployStatus}
            loading={infraActionLoading}
            error={infraActionError}
            onPause={onPause}
            onResume={onResume}
            onTeardown={onTeardown}
            className={CARD_HOVER}
          />
        )}

        <div className='flex justify-end'>
          <Button variant='primary' onClick={onGoToDashboard}>
            Go to dashboard
            <ArrowRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </WizardPanel>
  )
}

export default DeploymentSuccess
