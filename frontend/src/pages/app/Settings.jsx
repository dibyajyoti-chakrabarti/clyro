import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'

const AWS_REGIONS = [
  { value: 'ap-south-1',    label: 'Asia Pacific — Mumbai (ap-south-1)' },
  { value: 'ap-southeast-1',label: 'Asia Pacific — Singapore (ap-southeast-1)' },
  { value: 'ap-northeast-1',label: 'Asia Pacific — Tokyo (ap-northeast-1)' },
  { value: 'us-east-1',     label: 'US East — N. Virginia (us-east-1)' },
  { value: 'us-west-2',     label: 'US West — Oregon (us-west-2)' },
  { value: 'eu-west-1',     label: 'Europe — Ireland (eu-west-1)' },
  { value: 'eu-central-1',  label: 'Europe — Frankfurt (eu-central-1)' },
]

const STORAGE_KEY = 'clyro_preferred_region'

function Section({ title, description, children }) {
  return (
    <div className='rounded-xl border border-border bg-surface p-6'>
      <div>
        <h2 className='text-base font-semibold text-text-primary'>{title}</h2>
        {description && <p className='mt-0.5 text-sm text-text-muted'>{description}</p>}
      </div>
      <div className='mt-5'>{children}</div>
    </div>
  )
}

function ComingSoonRow({ icon, label, description }) {
  return (
    <div className='flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3'>
      <div className='flex items-center gap-3'>
        <i className={`${icon} text-base text-text-muted`} />
        <div>
          <p className='text-sm font-medium text-text-primary'>{label}</p>
          {description && <p className='text-xs text-text-muted'>{description}</p>}
        </div>
      </div>
      <span className='rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-text-muted'>
        Coming soon
      </span>
    </div>
  )
}

export default function Settings() {
  const [region, setRegion] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'ap-south-1'
  )
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(false)
  }, [region])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, region)
    setSaved(true)
  }

  return (
    <div className='mx-auto max-w-2xl space-y-5'>
      <h1 className='text-2xl font-semibold tracking-tight'>Settings</h1>

      <Section
        title='Default AWS Region'
        description='Used as the default when creating new projects. You can override this per project.'
      >
        <div className='flex items-center gap-3'>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className='flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'
          >
            {AWS_REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <Button variant='primary' size='sm' onClick={handleSave} disabled={saved}>
            {saved ? 'Saved ✓' : 'Save'}
          </Button>
        </div>
        <p className='mt-2 text-xs text-text-muted'>
          Stored locally in your browser. Sign-in on another device will use the default region.
        </p>
      </Section>

      <Section
        title='Notifications'
        description='Control how Clyro notifies you about your infrastructure.'
      >
        <div className='space-y-2'>
          <ComingSoonRow
            icon='ti ti-mail'
            label='Email notifications'
            description='Deployment success, failure, and cost alerts'
          />
          <ComingSoonRow
            icon='ti ti-brand-slack'
            label='Slack integration'
            description='Post deployment events to a Slack channel'
          />
          <ComingSoonRow
            icon='ti ti-webhook'
            label='Webhooks'
            description='Send events to your own endpoint'
          />
        </div>
      </Section>

      <Section
        title='Appearance'
        description='Visual preferences for the Clyro interface.'
      >
        <div className='space-y-2'>
          <ComingSoonRow
            icon='ti ti-moon'
            label='Theme'
            description='Light, dark, or system default'
          />
        </div>
      </Section>
    </div>
  )
}
