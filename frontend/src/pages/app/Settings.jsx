import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'

const AWS_REGIONS = [
  { value: 'ap-south-1',     label: 'Asia Pacific — Mumbai (ap-south-1)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific — Singapore (ap-southeast-1)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific — Tokyo (ap-northeast-1)' },
  { value: 'us-east-1',      label: 'US East — N. Virginia (us-east-1)' },
  { value: 'us-west-2',      label: 'US West — Oregon (us-west-2)' },
  { value: 'eu-west-1',      label: 'Europe — Ireland (eu-west-1)' },
  { value: 'eu-central-1',   label: 'Europe — Frankfurt (eu-central-1)' },
]

const STORAGE_KEY = 'clyro_preferred_region'

function Section({ title, description, children }) {
  return (
    <div className='overflow-hidden rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
      <div className='border-b border-white/[0.06] px-5 py-3.5'>
        <h2 className='text-sm font-semibold text-text-primary'>{title}</h2>
        {description && <p className='mt-0.5 text-xs text-text-muted'>{description}</p>}
      </div>
      <div className='px-5 py-4'>{children}</div>
    </div>
  )
}

function ComingSoonRow({ icon, label, description }) {
  return (
    <div className='flex items-center justify-between rounded-lg border border-white/[0.06] bg-background/50 px-4 py-3 transition-colors hover:bg-white/[0.02]'>
      <div className='flex items-center gap-3'>
        <div className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-text-muted'>
          <i className={`${icon} text-sm`} />
        </div>
        <div>
          <p className='text-sm font-medium text-text-primary'>{label}</p>
          {description && <p className='text-xs text-text-muted'>{description}</p>}
        </div>
      </div>
      <span className='rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-xs text-text-muted'>
        Coming soon
      </span>
    </div>
  )
}

export default function Settings() {
  const [region, setRegion] = useState(() => localStorage.getItem(STORAGE_KEY) || 'ap-south-1')
  const [saved, setSaved]   = useState(false)

  useEffect(() => { setSaved(false) }, [region])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, region)
    setSaved(true)
  }

  return (
    <div className='mx-auto max-w-2xl space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Settings</h1>
        <p className='mt-0.5 text-sm text-text-muted'>Manage your preferences.</p>
      </div>

      <Section
        title='Default AWS Region'
        description='Used as the default when creating new projects. You can override this per project.'
      >
        <div className='flex items-center gap-3'>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className='flex-1 rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary caret-accent transition-[border-color,box-shadow] duration-150 hover:border-white/[0.14] focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20'
          >
            {AWS_REGIONS.map((r) => (
              <option key={r.value} value={r.value} className='bg-surface'>{r.label}</option>
            ))}
          </select>
          <Button variant={saved ? 'secondary' : 'primary'} size='sm' onClick={handleSave} disabled={saved}>
            {saved ? '✓ Saved' : 'Save'}
          </Button>
        </div>
        <p className='mt-2 flex items-center gap-1.5 text-xs text-text-muted'>
          <i className='ti ti-device-laptop text-[11px]' />
          Stored locally in your browser — not synced across devices.
        </p>
      </Section>

      <Section
        title='Notifications'
        description='Control how Clyro notifies you about your infrastructure events.'
      >
        <div className='space-y-2'>
          <ComingSoonRow icon='ti ti-mail' label='Email notifications' description='Deployment success, failure, and cost alerts' />
          <ComingSoonRow icon='ti ti-brand-slack' label='Slack integration' description='Post deployment events to a channel' />
          <ComingSoonRow icon='ti ti-webhook' label='Webhooks' description='Send events to your own endpoint' />
        </div>
      </Section>

      <Section
        title='Appearance'
        description='Visual preferences for the Clyro interface.'
      >
        <div className='space-y-2'>
          <ComingSoonRow icon='ti ti-moon' label='Theme' description='Light, dark, or system default' />
        </div>
      </Section>
    </div>
  )
}
