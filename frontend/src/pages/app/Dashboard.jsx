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
  created:          'border-border text-text-muted',
  repo_connected:   'border-blue-500/30 bg-blue-500/10 text-blue-300',
  scanning:         'border-accent/30 bg-accent/10 text-accent',
  scan_complete:    'border-green-500/30 bg-green-500/10 text-green-300',
  intent_collected: 'border-green-500/30 bg-green-500/10 text-green-300',
  canvas_draft:     'border-amber-500/30 bg-amber-500/10 text-amber-300',
  canvas_finalized: 'border-green-500/30 bg-green-500/10 text-green-300',
  provisioning:     'border-accent/30 bg-accent/10 text-accent',
  live:             'border-green-500/30 bg-green-500/10 text-green-300',
  failed:           'border-red-500/30 bg-red-500/10 text-red-400',
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className='rounded-xl border border-border bg-background p-4'>
      <div className='flex items-center gap-2'>
        <i className={`${icon} text-sm ${accent ? 'text-accent' : 'text-text-muted'}`} />
        <p className='text-xs font-medium text-text-muted'>{label}</p>
      </div>
      <p className='mt-3 text-3xl font-semibold tracking-tight text-text-primary'>{value}</p>
    </div>
  )
}

function RecentProjectRow({ project }) {
  const label = STATUS_LABEL[project.status] ?? 'Unknown'
  const badge = STATUS_BADGE[project.status] ?? 'border-border text-text-muted'
  const isLive = project.status === 'live'
  const isFailed = project.status === 'failed'
  const isNew = project.status === 'created'
  const buttonLabel = isLive ? 'Open' : isFailed ? 'Retry' : isNew ? 'Start →' : 'Continue →'
  const isPrimary = !isLive && !isFailed && !isNew

  return (
    <div className='flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-text-primary'>{project.name}</p>
        {project.repo_full_name ? (
          <p className='mt-0.5 truncate text-xs text-text-muted'>{project.repo_full_name} · {project.repo_branch}</p>
        ) : (
          <p className='mt-0.5 text-xs text-text-muted'>No repository connected</p>
        )}
      </div>
      <div className='flex shrink-0 items-center gap-3'>
        <span className={`hidden rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-block ${badge}`}>
          {label}
        </span>
        <Link to={`/app/projects/${project.id}`}>
          <Button variant={isPrimary ? 'primary' : 'secondary'} size='sm'>{buttonLabel}</Button>
        </Link>
      </div>
    </div>
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
  const inProgress = projects.filter(
    (p) => !['created', 'live', 'failed'].includes(p.status)
  ).length

  const recent = projects.slice(0, 4)

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
        <Link to='/app/projects/new'>
          <Button variant='primary'>
            <i className='ti ti-plus text-sm' />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className='grid gap-4 sm:grid-cols-3'>
        <StatCard icon='ti ti-folder'       label='Total Projects' value={loading ? '—' : total} />
        <StatCard icon='ti ti-loader'       label='In Progress'    value={loading ? '—' : inProgress} accent />
        <StatCard icon='ti ti-circle-check' label='Live'           value={loading ? '—' : live} accent={live > 0} />
      </div>

      {/* Recent projects */}
      <div>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-base font-semibold text-text-primary'>Recent Projects</h2>
          <Link to='/app/projects' className='text-xs text-accent hover:underline'>
            View all →
          </Link>
        </div>

        {loading ? (
          <div className='flex h-32 items-center justify-center'>
            <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
          </div>
        ) : projects.length === 0 ? (
          <div className='rounded-xl border border-dashed border-border bg-background/50 py-12 text-center'>
            <i className='ti ti-folder-open text-3xl text-text-muted' />
            <p className='mt-3 text-sm font-semibold'>No projects yet</p>
            <p className='mt-1 text-xs text-text-muted'>Create your first project to deploy infrastructure on AWS.</p>
            <Link to='/app/projects/new'>
              <Button variant='primary' className='mt-4'>Create your first project</Button>
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
