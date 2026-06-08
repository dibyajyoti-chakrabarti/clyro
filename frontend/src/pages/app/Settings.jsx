import { useEffect, useState } from 'react'
import { Bell, Globe, Mail, MessageSquareMore, MoonStar, Palette, Workflow } from 'lucide-react'
import Button from '../../components/ui/Button'

const AWS_REGIONS = [
  { value: 'ap-south-1', label: 'Asia Pacific — Mumbai (ap-south-1)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific — Singapore (ap-southeast-1)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific — Tokyo (ap-northeast-1)' },
  { value: 'us-east-1', label: 'US East — N. Virginia (us-east-1)' },
  { value: 'us-west-2', label: 'US West — Oregon (us-west-2)' },
  { value: 'eu-west-1', label: 'Europe — Ireland (eu-west-1)' },
  { value: 'eu-central-1', label: 'Europe — Frankfurt (eu-central-1)' },
]

const STORAGE_KEY = 'clyro_preferred_region'

function Card({ children, className = '' }) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-surface/90 to-surface/40 p-6 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-md before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_60%)] before:content-[''] transition-all duration-200 hover:border-amber-300/20 hover:shadow-lg ${className}`.trim()}
    >
      <div className='relative'>{children}</div>
    </section>
  )
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
      <div className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-amber-300'>
        <Icon size={22} />
      </div>
      <div className='min-w-0'>
        <h2 className='text-2xl font-semibold text-white'>{title}</h2>
        <p className='mt-0.5 max-w-3xl text-text-muted'>{description}</p>
      </div>
    </div>
  )
}

function ComingSoonRow({ icon: Icon, label, description }) {
  return (
    <div className='flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-background/20 px-5 py-3 transition-colors hover:border-amber-300/20'>
      <div className='flex min-w-0 items-center gap-3'>
        <div className='grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-amber-300'>
          <Icon size={18} />
        </div>
        <div className='min-w-0'>
          <p className='text-base font-semibold text-text-primary'>{label}</p>
          <p className='text-sm text-text-muted'>{description}</p>
        </div>
      </div>
      <span className='shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-sm text-text-muted'>
        Coming soon
      </span>
    </div>
  )
}

export default function Settings() {
  const [region, setRegion] = useState(() => localStorage.getItem(STORAGE_KEY) || 'ap-south-1')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(false)
  }, [region])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, region)
    setSaved(true)
  }

  return (
    <div className='space-y-5'>
      <div className='mb-5'>
        <h1 className='text-5xl font-semibold text-white'>Settings</h1>
        <p className='mt-2 text-lg text-text-muted'>Manage your preferences.</p>
      </div>

      <Card>
        <div className='space-y-5'>
          <SectionHeader
            icon={Globe}
            title='Default AWS Region'
            description='Used as the default when creating new projects. You can override this per project.'
          />

          <div className='flex flex-col gap-2 md:flex-row md:items-center'>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className='h-12 flex-1 rounded-xl border border-white/[0.08] bg-background/40 px-4 text-sm text-text-primary outline-none transition-[border-color,box-shadow] duration-150 hover:border-white/[0.14] focus:border-amber-300/40 focus:ring-2 focus:ring-amber-400/20'
            >
              {AWS_REGIONS.map((r) => (
                <option key={r.value} value={r.value} className='bg-surface'>
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              variant='primary'
              onClick={handleSave}
              disabled={saved}
              className='h-12 w-full rounded-xl px-5 md:w-[120px]'
            >
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>

          <p className='text-sm text-text-muted'>Stored locally in your browser - not synced across devices.</p>
        </div>
      </Card>

      <Card>
        <div className='space-y-5'>
          <SectionHeader
            icon={Bell}
            title='Notifications'
            description='Control how Clyro notifies you about your infrastructure events.'
          />

          <div className='space-y-2'>
            <ComingSoonRow
              icon={Mail}
              label='Email notifications'
              description='Deployment success, failure, and cost alerts'
            />
            <ComingSoonRow
              icon={MessageSquareMore}
              label='Slack integration'
              description='Post deployment events to a channel'
            />
            <ComingSoonRow
              icon={Workflow}
              label='Webhooks'
              description='Send events to your own endpoint'
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className='space-y-5'>
          <SectionHeader
            icon={Palette}
            title='Appearance'
            description='Visual preferences for the Clyro interface.'
          />

          <div className='space-y-2'>
            <ComingSoonRow
              icon={MoonStar}
              label='Theme'
              description='Light, dark, or system default'
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
