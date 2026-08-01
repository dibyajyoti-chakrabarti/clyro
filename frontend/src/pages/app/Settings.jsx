import { useState } from 'react'
import { Globe, Monitor, MoonStar, Palette, Sun } from 'lucide-react'
import Button from '../../components/ui/Button'
import GlassSelect from '../../components/ui/GlassSelect'
import usePreferences from '../../context/usePreferences'

const AWS_REGIONS = [
  { value: 'ap-south-1', label: 'Asia Pacific — Mumbai (ap-south-1)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific — Singapore (ap-southeast-1)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific — Tokyo (ap-northeast-1)' },
  { value: 'us-east-1', label: 'US East — N. Virginia (us-east-1)' },
  { value: 'us-west-2', label: 'US West — Oregon (us-west-2)' },
  { value: 'eu-west-1', label: 'Europe — Ireland (eu-west-1)' },
  { value: 'eu-central-1', label: 'Europe — Frankfurt (eu-central-1)' },
]

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: MoonStar },
]

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
    <div className='flex flex-col gap-4 lg:flex-row lg:items-center'>
      <div className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-amber-300'>
        <Icon size={18} />
      </div>
      <div className='min-w-0'>
        <h2 className='text-2xl font-semibold text-text-primary'>{title}</h2>
        <p className='mt-0.5 max-w-3xl text-sm text-text-muted'>{description}</p>
      </div>
    </div>
  )
}

// Segmented system/light/dark switch — applies immediately via PreferencesContext.
function ThemeSwitch({ value, onChange }) {
  return (
    <div className='inline-flex rounded-2xl border border-white/[0.08] bg-background/30 p-1'>
      {THEME_OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            type='button'
            onClick={() => onChange(v)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-amber-400/15 text-amber-200 shadow-inner'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function Settings() {
  const { preferredRegion, setPreferredRegion, theme, setTheme } = usePreferences()
  const [region, setRegion] = useState(preferredRegion)
  const dirty = region !== preferredRegion

  const handleSave = () => setPreferredRegion(region)

  return (
    <div className='space-y-5'>
      <div className='mb-6'>
        <h1 className='text-5xl font-semibold text-text-primary'>Settings</h1>
        <p className='mt-2 text-base text-text-muted'>Manage your preferences.</p>
      </div>

      <Card>
        <div className='space-y-4'>
          <SectionHeader
            icon={Globe}
            title='Default AWS Region'
            description='Used as the default when creating new projects. You can override this per project.'
          />

          <div className='flex flex-col gap-2 md:flex-row md:items-center'>
            <GlassSelect options={AWS_REGIONS} value={region} onChange={setRegion} />
            <Button
              variant='primary'
              onClick={handleSave}
              disabled={!dirty}
              className='h-12 w-full rounded-xl px-5 md:w-[120px]'
            >
              {dirty ? 'Save' : 'Saved'}
            </Button>
          </div>

          <p className='text-sm text-text-muted'>
            Stored locally in your browser — not synced across devices.
          </p>
        </div>
      </Card>

      <Card>
        <div className='space-y-4'>
          <SectionHeader
            icon={Palette}
            title='Appearance'
            description='Visual preferences for the Clyro interface.'
          />

          <div className='flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-background/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <p className='text-base font-semibold text-text-primary'>Theme</p>
              <p className='text-sm text-text-muted'>Light, dark, or match your system.</p>
            </div>
            <ThemeSwitch value={theme} onChange={setTheme} />
          </div>
        </div>
      </Card>
    </div>
  )
}
