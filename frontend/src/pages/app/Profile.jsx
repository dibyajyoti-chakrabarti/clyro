import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'aws-amplify/auth'
import { BadgeCheck, Calendar, Crown, FolderOpen, Mail, ShieldCheck, TriangleAlert, User } from 'lucide-react'
import githubLogoDark from "../../assets/logos/github_black.svg";
import { api } from '../../api'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import GitHubLogo from '../../components/common/GitHubLogo'

const TIER_META = {
  free: {
    label: 'Free Plan',
    badge: 'border-white/[0.08] bg-white/[0.04] text-text-muted',
  },
  pro: {
    label: 'Pro Plan',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  },
  enterprise: {
    label: 'Enterprise Plan',
    badge: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  },
}

const GENERAL_ROWS = [
  { key: 'name', label: 'Name', description: 'Your display name', icon: User },
  { key: 'email', label: 'Email', description: 'Your email address', icon: Mail },
  { key: 'auth', label: 'Authentication', description: 'Your authentication provider', icon: ShieldCheck },
]

function formatJoinedDate(iso) {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(iso))
}

function Avatar({ name, avatarUrl }) {
  const initials = (name || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar'}
        referrerPolicy='no-referrer'
        className='h-[112px] w-[112px] shrink-0 rounded-full border-2 border-white/90 object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_18px_50px_rgba(0,0,0,0.28)]'
      />
    )
  }

  return (
    <div className='grid h-[112px] w-[112px] shrink-0 place-items-center rounded-full border-2 border-white/90 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-amber-400 text-3xl font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_18px_50px_rgba(0,0,0,0.28)]'>
      {initials}
    </div>
  )
}

function SectionCard({ title, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-surface/40 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur-md transition-all duration-200 hover:border-amber-300/20 hover:shadow-lg ${className}`.trim()}
    >
      <div className='border-b border-white/[0.06] px-5 py-4'>
        <h2 className='text-xl font-semibold text-text-primary'>{title}</h2>
      </div>
      <div className='px-5 py-4'>{children}</div>
    </section>
  )
}

function CompactRow({ icon: Icon, label, description, value, onEdit, showEdit = false, editing, nameValue, setNameValue, nameInputRef, nameSaving, handleSaveName, cancelEdit, nameError }) {
  return (
    <div className='grid gap-4 border-t border-white/[0.05] py-3 first:border-t-0 md:grid-cols-[1fr_auto] md:items-center'>
      <div className='flex items-center gap-4'>
        <div className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-amber-300'>
          <Icon size={20} />
        </div>
        <div>
          <p className='text-sm font-semibold text-text-primary'>{label}</p>
          <p className='text-sm text-text-muted'>{description}</p>
        </div>
      </div>
      <div className='flex flex-col items-start gap-2 md:items-end'>
        {editing ? (
          <div className='flex flex-wrap items-center gap-2'>
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') cancelEdit()
              }}
              className='min-w-[220px] rounded-xl border border-white/[0.09] bg-background/80 px-3 py-2 text-sm text-text-primary caret-amber-400 outline-none transition-colors focus:border-amber-400/40'
            />
            <Button variant='primary' size='sm' onClick={handleSaveName} disabled={nameSaving}>
              {nameSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant='ghost' size='sm' onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className='flex items-center gap-3'>
            <span className='text-sm text-text-primary'>{value}</span>
            {showEdit ? (
              <Button variant='ghost' size='sm' onClick={onEdit}>
                Edit
              </Button>
            ) : null}
          </div>
        )}
        {nameError ? <p className='text-xs text-danger'>{nameError}</p> : null}
      </div>
    </div>
  )
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

  const tierKey = profile?.subscription_tier || 'free'
  const tierMeta = TIER_META[tierKey] ?? TIER_META.free

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]' />
      </div>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='space-y-1'>
        <h1 className='text-4xl font-semibold tracking-tight text-text-primary'>Profile</h1>
        <p className='text-base text-text-muted'>Manage your account settings and preferences.</p>
      </div>

      <section className='rounded-2xl border border-white/[0.08] bg-surface/40 px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-md transition-all duration-200 hover:border-amber-300/20 hover:shadow-lg'>
        <div className='flex min-h-[150px] flex-col items-center gap-4 py-1 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-col items-center gap-4 text-center lg:flex-row lg:text-left'>
            <Avatar name={profile?.name} avatarUrl={profile?.avatar_url} />
            <div className='min-w-0'>
              <p className='truncate text-4xl font-semibold tracking-tight text-text-primary'>{profile?.name || '-'}</p>
              <p className='mt-1 truncate text-lg text-text-muted'>{profile?.email || '-'}</p>
              <div className='mt-3 flex flex-wrap justify-center gap-2 lg:justify-start'>
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${tierMeta.badge}`}>
                  <BadgeCheck size={14} />
                  {tierMeta.label}
                </span>
                <span className='inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-text-muted'>
                  <FolderOpen size={14} />
                  {profile?.project_count ?? 0} Projects
                </span>
                <span className='inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-text-muted'>
                  <Calendar size={14} />
                  Joined {formatJoinedDate(profile?.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionCard title='General Information'>
        <div>
          <CompactRow
            icon={GENERAL_ROWS[0].icon}
            label={GENERAL_ROWS[0].label}
            description={GENERAL_ROWS[0].description}
            value={profile?.name || '-'}
            showEdit
            onEdit={() => setEditing(true)}
            editing={editing}
            nameValue={nameValue}
            setNameValue={setNameValue}
            nameInputRef={nameInputRef}
            nameSaving={nameSaving}
            handleSaveName={handleSaveName}
            cancelEdit={() => {
              setEditing(false)
              setNameValue(profile.name)
              setNameError('')
            }}
            nameError={nameError}
          />
          <CompactRow
            icon={GENERAL_ROWS[1].icon}
            label={GENERAL_ROWS[1].label}
            description={GENERAL_ROWS[1].description}
            value={profile?.email || '-'}
          />
          <CompactRow
            icon={GENERAL_ROWS[2].icon}
            label={GENERAL_ROWS[2].label}
            description={GENERAL_ROWS[2].description}
            value='AWS Cognito'
          />
        </div>
      </SectionCard>

      <SectionCard title='GitHub Connections'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='flex min-w-0 items-center gap-4'>
            <div className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04]'>
              <GitHubLogo className='h-6 w-6' />
            </div>
            <div className='min-w-0'>
              <p className='text-lg font-semibold text-text-primary'>
                {installations.length === 0 ? 'No GitHub account connected' : 'GitHub account connected'}
              </p>
              <p className='mt-1 max-w-2xl text-sm text-text-muted'>
                Connect your GitHub account to import repositories and streamline workflows.
              </p>
            </div>
          </div>

          <Button
            variant='primary'
            className='w-full rounded-xl bg-amber-400 px-6 py-3 text-black hover:bg-amber-300 md:w-auto'
            onClick={() => window.open(`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_NAME}/installations/new`, '_blank')}
          >
            <img src={githubLogoDark} alt='' className='h-4 w-4' />
            Connect GitHub
          </Button>
        </div>
      </SectionCard>

      <SectionCard title='Subscription Plan'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='flex min-w-0 items-center gap-4'>
            <div className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-300'>
              <Crown size={20} />
            </div>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-lg font-semibold text-text-primary'>{tierMeta.label}</p>
                <span className='rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-text-muted'>
                  Current
                </span>
              </div>
              <div className='mt-3 grid gap-2 text-sm text-text-primary'>
                <div className='flex items-center gap-2'>
                  <span className='text-amber-300'>✓</span>
                  <span>Up to 3 projects</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-amber-300'>✓</span>
                  <span>Community support</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-amber-300'>✓</span>
                  <span>Basic infrastructure</span>
                </div>
              </div>
            </div>
          </div>

          <div className='flex w-full flex-col gap-3 md:w-auto md:items-end'>
            <Button variant='primary' className='w-full rounded-xl bg-amber-400 px-6 py-3 text-black hover:bg-amber-300 md:w-auto'>
              Upgrade to Pro
            </Button>
            <a href='/pricing' className='text-sm text-amber-300/80 transition-colors hover:text-amber-200'>
              View all plans →
            </a>
          </div>
        </div>
      </SectionCard>

      <section className='rounded-2xl border border-red-500/30 bg-red-500/[0.03] shadow-[0_16px_60px_rgba(0,0,0,0.16)] transition-all duration-200 hover:shadow-lg'>
        <div className='flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between'>
          <div className='flex min-w-0 items-center gap-4'>
            <div className='grid h-12 w-12 shrink-0 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400'>
              <TriangleAlert size={20} />
            </div>
            <div className='min-w-0'>
              <h2 className='text-xl font-semibold text-text-primary'>Danger Zone</h2>
              <p className='mt-1 max-w-3xl text-sm leading-6 text-text-muted'>
                Deleting your account is permanent. All projects, scans, and infrastructure records will be removed immediately.
                AWS resources already provisioned in your account are not affected.
              </p>
            </div>
          </div>

          <Button variant='danger' className='w-full rounded-xl px-6 py-3 md:w-auto' onClick={() => setShowDeleteDialog(true)}>
            Delete account
          </Button>
        </div>
      </section>

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
