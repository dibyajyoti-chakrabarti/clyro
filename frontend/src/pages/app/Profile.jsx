import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'aws-amplify/auth'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const TIER_META = {
  free:       { label: 'Free',       badge: 'border-border bg-background text-text-muted' },
  pro:        { label: 'Pro',        badge: 'border-accent/40 bg-accent/10 text-accent' },
  enterprise: { label: 'Enterprise', badge: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
}

function Avatar({ name, size = 'lg' }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sizeClass = size === 'lg'
    ? 'h-16 w-16 text-xl'
    : 'h-9 w-9 text-sm'

  return (
    <div className={`grid place-items-center rounded-full border border-accent/30 bg-accent/10 font-semibold text-accent ${sizeClass}`}>
      {initials}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className='rounded-xl border border-border bg-surface p-6'>
      <h2 className='text-base font-semibold text-text-primary'>{title}</h2>
      <div className='mt-4'>{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className='flex items-center justify-between py-2.5 border-t border-border first:border-t-0'>
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
    if (!trimmed || trimmed === profile.name) {
      setEditing(false)
      return
    }
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
        <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-2xl space-y-5'>
      <h1 className='text-2xl font-semibold tracking-tight'>Profile</h1>

      {/* Header card */}
      <div className='flex items-center gap-4 rounded-xl border border-border bg-surface p-6'>
        <Avatar name={profile?.name} />
        <div className='min-w-0'>
          <p className='truncate text-lg font-semibold text-text-primary'>{profile?.name || '—'}</p>
          <p className='truncate text-sm text-text-muted'>{profile?.email || '—'}</p>
          <div className='mt-1.5 flex items-center gap-2'>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tierMeta.badge}`}>
              {tierMeta.label}
            </span>
            <span className='text-xs text-text-muted'>
              · {profile?.project_count ?? 0} project{profile?.project_count !== 1 ? 's' : ''}
            </span>
            <span className='text-xs text-text-muted'>
              · Member since {formatDate(profile?.created_at)}
            </span>
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
                className='rounded-md border border-border bg-background px-2.5 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'
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
              <button
                type='button'
                onClick={() => setEditing(true)}
                className='text-xs text-accent hover:underline'
              >
                Edit
              </button>
            </div>
          )}
        </Row>
        {nameError && <p className='mt-1 text-xs text-red-400'>{nameError}</p>}
        <Row label='Email'>
          <span className='text-text-muted'>{profile?.email || '—'}</span>
        </Row>
        <Row label='Authentication'>
          <span className='text-text-muted'>AWS Cognito</span>
        </Row>
      </Section>

      {/* GitHub connections */}
      <Section title='GitHub Connections'>
        {installations.length === 0 ? (
          <p className='text-sm text-text-muted'>No GitHub accounts connected.</p>
        ) : (
          <div className='space-y-2'>
            {installations.map((inst) => (
              <div key={inst.id} className='flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5'>
                <div className='flex items-center gap-3'>
                  {inst.account_avatar_url ? (
                    <img src={inst.account_avatar_url} alt='' className='h-7 w-7 rounded-full' />
                  ) : (
                    <Avatar name={inst.account_login} size='sm' />
                  )}
                  <div>
                    <p className='text-sm font-medium text-text-primary'>{inst.account_login}</p>
                    <p className='text-xs text-text-muted'>{inst.account_type}</p>
                  </div>
                </div>
                <span className='rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-300'>
                  Connected
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          type='button'
          onClick={() => {
            const appName = import.meta.env.VITE_GITHUB_APP_NAME
            window.open(`https://github.com/apps/${appName}/installations/new`, '_blank')
          }}
          className='mt-3 text-xs text-accent hover:underline'
        >
          + Connect another account
        </button>
      </Section>

      {/* Plan */}
      <Section title='Plan'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium text-text-primary'>{tierMeta.label} Plan</p>
            <p className='mt-0.5 text-xs text-text-muted'>
              {profile?.subscription_tier === 'free'
                ? 'Up to 3 projects · community support'
                : profile?.subscription_tier === 'pro'
                  ? 'Unlimited projects · priority support'
                  : 'Custom limits · dedicated support'}
            </p>
          </div>
          {profile?.subscription_tier === 'free' && (
            <Button variant='primary' size='sm'>Upgrade to Pro</Button>
          )}
        </div>
      </Section>

      {/* Danger zone */}
      <div className='rounded-xl border border-red-500/20 bg-surface p-6'>
        <h2 className='text-base font-semibold text-red-400'>Danger Zone</h2>
        <p className='mt-1 text-sm text-text-muted'>
          Deleting your account is permanent. All projects, scans, and infrastructure records will be removed immediately. AWS resources already provisioned in your account are not affected.
        </p>
        <Button
          variant='danger'
          className='mt-4'
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete account
        </Button>
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
