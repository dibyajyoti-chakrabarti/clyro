import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'aws-amplify/auth'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const TIER_META = {
  free:       { label: 'Free',       badge: 'border-border/60 text-text-muted' },
  pro:        { label: 'Pro',        badge: 'border-accent/40 bg-accent/10 text-accent shadow-[0_0_8px_rgba(249,115,22,0.15)]' },
  enterprise: { label: 'Enterprise', badge: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
}

const PLAN_DESCRIPTION = {
  free:       'Up to 3 projects · community support',
  pro:        'Unlimited projects · priority support',
  enterprise: 'Custom limits · dedicated support',
}

function Avatar({ name, avatarUrl, size = 'lg' }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const sizeClass = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-8 w-8 text-xs'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar'}
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-full object-cover ring-2 ring-accent/20 ${sizeClass}`}
      />
    )
  }

  return (
    <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 font-semibold text-accent ring-2 ring-accent/20 ${sizeClass}`}>
      {initials}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className='overflow-hidden rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
      <div className='border-b border-white/[0.06] px-5 py-3.5'>
        <h2 className='text-sm font-semibold text-text-primary'>{title}</h2>
      </div>
      <div className='px-5 py-4'>{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className='flex items-center justify-between border-t border-white/[0.05] py-3 first:border-t-0'>
      <p className='text-sm text-text-muted'>{label}</p>
      <div className='text-sm text-text-primary'>{children}</div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [installations, setInstallations] = useState([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const nameInputRef = useRef(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([api.getMe(), api.listInstallations()])
      .then(([user, inst]) => {
        setProfile(user)
        setNameValue(user.name)
        setInstallations(inst)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editing])

  const handleSaveName = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === profile.name) { setEditing(false); return }
    setNameSaving(true)
    setNameError('')
    try {
      const updated = await api.updateMe({ name: trimmed })
      setProfile(updated)
      setEditing(false)
    } catch (err) {
      setNameError(err.message || 'Failed to save')
    } finally {
      setNameSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.deleteMe()
      await signOut()
      navigate('/', { replace: true })
    } catch {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const tierMeta = TIER_META[profile?.subscription_tier] ?? TIER_META.free

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]' />
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-2xl space-y-4'>
      <h1 className='text-2xl font-semibold tracking-tight'>Profile</h1>

      {/* Header card */}
      <div className='flex items-center gap-4 rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent p-5 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
        <Avatar name={profile?.name} avatarUrl={profile?.avatar_url} />
        <div className='min-w-0 flex-1'>
          <p className='truncate text-lg font-semibold'>{profile?.name || '—'}</p>
          <p className='truncate text-sm text-text-muted'>{profile?.email || '—'}</p>
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tierMeta.badge}`}>
              {tierMeta.label}
            </span>
            <span className='text-xs text-text-muted'>·</span>
            <span className='text-xs text-text-muted'>{profile?.project_count ?? 0} project{profile?.project_count !== 1 ? 's' : ''}</span>
            <span className='text-xs text-text-muted'>·</span>
            <span className='text-xs text-text-muted'>Since {formatDate(profile?.created_at)}</span>
          </div>
        </div>
      </div>

      {/* General */}
      <Section title='General'>
        <Row label='Name'>
          {editing ? (
            <div className='flex items-center gap-2'>
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') { setEditing(false); setNameValue(profile.name) }
                }}
                className='rounded-lg border border-white/[0.09] bg-background px-2.5 py-1.5 text-sm caret-accent transition-[border-color,box-shadow] duration-150 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20'
              />
              <Button variant='primary' size='sm' onClick={handleSaveName} disabled={nameSaving}>
                {nameSaving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant='ghost' size='sm' onClick={() => { setEditing(false); setNameValue(profile.name) }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className='flex items-center gap-3'>
              <span>{profile?.name || '—'}</span>
              <button type='button' onClick={() => setEditing(true)} className='text-xs text-accent/70 transition-colors hover:text-accent'>
                Edit
              </button>
            </div>
          )}
        </Row>
        {nameError && <p className='pb-2 text-xs text-danger'>{nameError}</p>}
        <Row label='Email'>
          <span className='text-text-muted'>{profile?.email || '—'}</span>
        </Row>
        <Row label='Authentication'>
          <div className='flex items-center gap-1.5 text-text-muted'>
            <i className='ti ti-shield-check text-sm text-green-400' />
            <span>AWS Cognito</span>
          </div>
        </Row>
      </Section>

      {/* GitHub connections */}
      <Section title='GitHub Connections'>
        {installations.length === 0 ? (
          <p className='py-1 text-sm text-text-muted'>No GitHub accounts connected.</p>
        ) : (
          <div className='space-y-2'>
            {installations.map((inst) => (
              <div key={inst.id} className='flex items-center justify-between rounded-lg border border-white/[0.06] bg-background/50 px-3 py-2.5'>
                <div className='flex items-center gap-3'>
                  {inst.account_avatar_url ? (
                    <img src={inst.account_avatar_url} alt='' className='h-7 w-7 rounded-full ring-1 ring-white/10' />
                  ) : (
                    <Avatar name={inst.account_login} size='sm' />
                  )}
                  <div>
                    <p className='text-sm font-medium'>{inst.account_login}</p>
                    <p className='text-xs text-text-muted'>{inst.account_type}</p>
                  </div>
                </div>
                <span className='rounded-full border border-green-500/30 bg-green-500/8 px-2 py-0.5 text-xs text-green-400'>
                  Connected
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          type='button'
          onClick={() => window.open(`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_NAME}/installations/new`, '_blank')}
          className='mt-3 text-xs text-accent/70 transition-colors hover:text-accent'
        >
          + Connect another account
        </button>
      </Section>

      {/* Plan */}
      <Section title='Plan'>
        <div className='flex items-center justify-between py-1'>
          <div>
            <div className='flex items-center gap-2'>
              <p className='text-sm font-semibold'>{tierMeta.label} Plan</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tierMeta.badge}`}>{tierMeta.label}</span>
            </div>
            <p className='mt-0.5 text-xs text-text-muted'>{PLAN_DESCRIPTION[profile?.subscription_tier] ?? PLAN_DESCRIPTION.free}</p>
          </div>
          {profile?.subscription_tier === 'free' && (
            <Button variant='primary' size='sm'>Upgrade to Pro</Button>
          )}
        </div>
      </Section>

      {/* Danger zone */}
      <div className='overflow-hidden rounded-xl border border-red-500/15 bg-surface shadow-sm shadow-black/20'>
        <div className='border-b border-red-500/10 px-5 py-3.5'>
          <h2 className='text-sm font-semibold text-red-400'>Danger Zone</h2>
        </div>
        <div className='px-5 py-4'>
          <p className='text-sm text-text-muted'>
            Deleting your account is permanent. All projects, scans, and infrastructure records will be removed immediately.
            AWS resources already provisioned in your account are not affected.
          </p>
          <Button variant='danger' className='mt-4' onClick={() => setShowDeleteDialog(true)}>
            <i className='ti ti-trash text-sm' />
            Delete account
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        title='Delete account'
        description='This will permanently delete your Clyro account and all associated data. This cannot be undone. AWS resources already deployed in your account will not be touched.'
        confirmText={deleting ? 'Deleting…' : 'Yes, delete my account'}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  )
}
