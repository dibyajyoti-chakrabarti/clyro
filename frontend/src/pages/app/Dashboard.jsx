import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'

const STATUS_LABEL = {
  created:          'Not started',
  repo_connected:   'Repo connected',
  scanning:         'Analysing…',
  scan_complete:    'Step 1 done',
  intent_collected: 'Step 2 done',
  canvas_draft:     'Step 3 in progress',
  canvas_finalized: 'Step 3 done',
  provisioning:     'Provisioning…',
  live:             'Live',
  failed:           'Failed',
}

const STATUS_BADGE = {
  created:          'border-border/60 text-text-muted',
  repo_connected:   'border-blue-500/30 bg-blue-500/8 text-blue-400',
  scanning:         'border-accent/30 bg-accent/8 text-accent',
  scan_complete:    'border-green-500/30 bg-green-500/8 text-green-400',
  intent_collected: 'border-green-500/30 bg-green-500/8 text-green-400',
  canvas_draft:     'border-amber-500/30 bg-amber-500/8 text-amber-400',
  canvas_finalized: 'border-green-500/30 bg-green-500/8 text-green-400',
  provisioning:     'border-accent/30 bg-accent/8 text-accent',
  live:             'border-green-500/40 bg-green-500/10 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.15)]',
  failed:           'border-red-500/30 bg-red-500/8 text-red-400',
}

function StatCard({ icon, label, value, glow }) {
  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-gradient-to-b from-white/[0.03] to-transparent p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 ${glow ? 'border-accent/20 shadow-[0_0_30px_rgba(249,115,22,0.06)]' : 'border-white/[0.07]'}`}>
      <div className='flex items-center justify-between'>
        <p className='text-xs font-medium uppercase tracking-widest text-text-muted'>{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${glow ? 'bg-accent/12 text-accent' : 'bg-white/[0.05] text-text-muted'}`}>
          <i className={`${icon} text-sm`} />
        </div>
      </div>
      <p className='mt-4 text-3xl font-semibold tracking-tight'>{value}</p>
    </div>
  )
}

function RecentProjectRow({ project }) {
  const label = STATUS_LABEL[project.status] ?? 'Unknown'
  const badge = STATUS_BADGE[project.status] ?? 'border-border/60 text-text-muted'
  const isLive    = project.status === 'live'
  const isFailed  = project.status === 'failed'
  const isNew     = project.status === 'created'
  const isPrimary = !isLive && !isFailed && !isNew

  return (
    <Link
      to={`/app/projects/${project.id}`}
      className='group flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-background/60 px-4 py-3.5 transition-all duration-150 hover:border-accent/20 hover:bg-white/[0.03] hover:shadow-md hover:shadow-black/20'
    >
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors duration-150'>{project.name}</p>
        <p className='mt-0.5 truncate text-xs text-text-muted'>
          {project.repo_full_name ? `${project.repo_full_name} · ${project.repo_branch}` : 'No repository connected'}
        </p>
      </div>
      <div className='flex shrink-0 items-center gap-3'>
        <span className={`hidden rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-block ${badge}`}>
          {label}
        </span>
        <div className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${isPrimary ? 'border-accent/40 bg-accent/10 text-accent group-hover:bg-accent/15' : 'border-white/[0.09] bg-white/[0.03] text-text-muted group-hover:text-text-primary'}`}>
          {isLive ? 'Open' : isFailed ? 'Retry' : isNew ? 'Start →' : 'Continue →'}
        </div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const total      = projects.length
  const live       = projects.filter((p) => p.status === 'live').length
  const inProgress = projects.filter((p) => !['created', 'live', 'failed'].includes(p.status)).length
  const recent     = projects.slice(0, 4)

  return (
    <div className='space-y-7'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
          <p className='mt-0.5 text-sm text-text-muted'>Your infrastructure at a glance.</p>
        </div>
        <Link to='/app/projects/new'>
          <Button variant='primary'>
            <i className='ti ti-plus text-sm' />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className='grid gap-3 sm:grid-cols-3'>
        <StatCard icon='ti ti-folder-filled' label='Total Projects' value={loading ? '—' : total} />
        <StatCard icon='ti ti-refresh'       label='In Progress'    value={loading ? '—' : inProgress} glow={inProgress > 0} />
        <StatCard icon='ti ti-activity'      label='Live'           value={loading ? '—' : live}       glow={live > 0} />
      </div>

      {/* Recent projects */}
      <div>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-sm font-semibold uppercase tracking-widest text-text-muted'>Recent Projects</h2>
          <Link to='/app/projects' className='text-xs text-accent/80 transition-colors hover:text-accent'>
            View all →
          </Link>
        </div>

        {loading ? (
          <div className='flex h-48 items-center justify-center rounded-xl border border-white/[0.06]'>
            <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]' />
          </div>
        ) : projects.length === 0 ? (
          <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-gradient-to-b from-white/[0.015] to-transparent py-16 text-center'>
            <div className='grid h-16 w-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]'>
              <i className='ti ti-folder-open text-3xl text-text-muted' />
            </div>
            <p className='mt-4 text-sm font-semibold'>No projects yet</p>
            <p className='mt-1.5 max-w-[280px] text-xs leading-relaxed text-text-muted'>
              Create your first project to start scanning your repo and deploying to AWS.
            </p>
            <Link to='/app/projects/new'>
              <Button variant='primary' className='mt-5'>Create your first project</Button>
            </Link>
          </div>
        ) : (
          <div className='space-y-2'>
            {recent.map((p) => <RecentProjectRow key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
