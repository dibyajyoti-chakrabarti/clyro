import awsLogo from '../../../../../assets/logos/AWS_Logo.svg'
import celeryLogo from '../../../../../assets/logos/celery.svg'
import cloudfrontLogo from '../../../../../assets/logos/cloudfront_logo.svg'
import djangoLogo from '../../../../../assets/logos/django.svg'
import postgresLogo from '../../../../../assets/logos/postgresql.svg'
import reactLogo from '../../../../../assets/logos/react.svg'
import redisLogo from '../../../../../assets/logos/redis.svg'

const logoByNode = (node) => {
  const label = `${node.label ?? ''} ${node.aws ?? ''} ${node.type ?? ''}`.toLowerCase()
  if (label.includes('react') || label.includes('frontend') || label.includes('cloudfront')) return reactLogo
  if (label.includes('celery') || label.includes('worker')) return celeryLogo
  if (label.includes('django') || label.includes('backend') || label.includes('ecs')) return djangoLogo
  if (label.includes('postgres') || label.includes('database') || label.includes('rds')) return postgresLogo
  if (label.includes('redis') || label.includes('cache')) return redisLogo
  if (label.includes('s3') || label.includes('cloudfront')) return cloudfrontLogo
  return awsLogo
}

const accentByNode = (node) => {
  const label = `${node.label ?? ''} ${node.aws ?? ''} ${node.type ?? ''}`.toLowerCase()
  if (label.includes('react') || label.includes('frontend') || label.includes('cloudfront')) return '#61DAFB'
  if (label.includes('celery') || label.includes('worker')) return '#F97316'
  if (label.includes('django') || label.includes('backend') || label.includes('ecs')) return '#2563EB'
  if (label.includes('postgres') || label.includes('database') || label.includes('rds')) return '#22C55E'
  if (label.includes('redis') || label.includes('cache')) return '#EF4444'
  if (label.includes('sqs') || label.includes('queue')) return '#FBBF24'
  return '#E8B84B'
}

export default function CanvasNode({ node, isSelected, position, accentByType, iconByType, onClick }) {
  const logo = logoByNode(node)
  const accent = accentByNode(node)

  return (
    <button
      type='button'
      className={`absolute w-[208px] rounded-[16px] border border-white/[0.08] bg-[rgba(12,15,20,0.92)] px-4 py-3 text-left shadow-[0_14px_30px_rgba(0,0,0,0.22)] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-white/[0.14] hover:shadow-[0_18px_36px_rgba(0,0,0,0.28)] ${isSelected ? 'ring-2 ring-[rgba(255,196,0,0.22)]' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={onClick}
    >
      <span
        className='absolute left-0 top-0 h-full w-[4px] rounded-l-[16px]'
        style={{ backgroundColor: accent }}
      />
      <span className='absolute right-3 top-3 h-2 w-2 rounded-full bg-[#22C55E] shadow-[0_0_0_4px_rgba(34,197,94,0.08)]' />

      <div className='flex items-start gap-3 pl-2'>
        <div className='mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.08] bg-white/[0.03]'>
          <img src={logo} alt='' className='h-5 w-5 object-contain' />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-[16px] font-semibold leading-5 text-text-primary'>{node.label}</p>
          <div className='mt-2 inline-flex max-w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[12px] font-medium text-text-muted'>
            <span className='truncate'>{node.aws}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
