import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'

const STATUS_META = {
  created:           { label: 'Not started',      step: 0, badge: 'border-border text-text-muted' },
  repo_connected:    { label: 'Repo connected',   step: 1, badge: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  scanning:          { label: 'Analysing repo…',  step: 1, badge: 'border-accent/30 bg-accent/10 text-accent' },
  scan_complete:     { label: 'Step 1 done',      step: 1, badge: 'border-green-500/30 bg-green-500/10 text-green-300' },
  intent_collected:  { label: 'Step 2 done',      step: 2, badge: 'border-green-500/30 bg-green-500/10 text-green-300' },
  canvas_draft:      { label: 'Step 3 in progress', step: 3, badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  canvas_finalized:  { label: 'Step 3 done',      step: 3, badge: 'border-green-500/30 bg-green-500/10 text-green-300' },
  provisioning:      { label: 'Provisioning…',    step: 4, badge: 'border-accent/30 bg-accent/10 text-accent' },
  live:              { label: 'Live',              step: 5, badge: 'border-green-500/30 bg-green-500/10 text-green-300' },
  failed:            { label: 'Failed',            step: 0, badge: 'border-red-500/30 bg-red-500/10 text-red-400' },
}

function StepDots({ completedStep }) {
  return (
    <div className='flex items-center gap-1.5'>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-1.5 w-5 rounded-full transition-colors ${
            n <= completedStep ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}

function ProjectRow({ project }) {
  const meta = STATUS_META[project.status] ?? STATUS_META.created
  const isLive = project.status === 'live'
  const isFailed = project.status === 'failed'
  const isInProgress = !isLive && project.status !== 'created'

  const buttonLabel = isLive ? 'Open' : isFailed ? 'Retry' : isInProgress ? 'Continue →' : 'Start →'

  return (
    <div className='grid items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 md:grid-cols-[1fr_auto_auto_auto]'>
      <div className='min-w-0'>
        <p className='truncate text-sm font-semibold text-text-primary'>{project.name}</p>
        {project.repo_full_name ? (
          <p className='mt-0.5 truncate text-xs text-text-muted'>{project.repo_full_name} · {project.repo_branch}</p>
        ) : (
          <p className='mt-0.5 text-xs text-text-muted'>No repository connected</p>
        )}
      </div>

      <StepDots completedStep={meta.step} />

      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>
        {meta.label}
      </span>

      <Link to={`/app/projects/${project.id}`}>
        <Button variant={isInProgress ? 'primary' : 'secondary'} size='sm'>
          {buttonLabel}
        </Button>
      </Link>
    </div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.repo_full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const inProgress = filtered.filter((p) => !['created', 'live', 'failed'].includes(p.status))
  const rest = filtered.filter((p) => ['created', 'live', 'failed'].includes(p.status))

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
        <Link to='/app/projects/new'>
          <Button variant='primary'>New Project</Button>
        </Link>
      </div>

      <div className='rounded-xl border border-border bg-surface px-4 py-3'>
        <input
          className='w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none'
          placeholder='Search by name or repository…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className='flex h-40 items-center justify-center'>
          <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
        </div>
      ) : projects.length === 0 ? (
        <div className='rounded-xl border border-border bg-surface py-12 text-center'>
          <p className='text-base font-semibold'>No projects yet</p>
          <p className='mt-2 text-sm text-text-muted'>Create your first project to get started.</p>
          <Link to='/app/projects/new'>
            <Button variant='primary' className='mt-4'>Create Project</Button>
          </Link>
        </div>
      ) : (
        <div className='space-y-6'>
          {inProgress.length > 0 && (
            <div>
              <p className='mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted'>In progress</p>
              <div className='space-y-2'>
                {inProgress.map((p) => <ProjectRow key={p.id} project={p} />)}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {inProgress.length > 0 && (
                <p className='mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted'>All projects</p>
              )}
              <div className='space-y-2'>
                {rest.map((p) => <ProjectRow key={p.id} project={p} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
