import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'

const STATUS_META = {
  created:           { label: 'Not started',        step: 0, badge: 'border-border/60 text-text-muted' },
  repo_connected:    { label: 'Repo connected',     step: 1, badge: 'border-blue-500/30 bg-blue-500/8 text-blue-400' },
  scanning:          { label: 'Analysing repo…',    step: 1, badge: 'border-accent/30 bg-accent/8 text-accent' },
  scan_complete:     { label: 'Step 1 done',        step: 1, badge: 'border-green-500/30 bg-green-500/8 text-green-400' },
  intent_collected:  { label: 'Step 2 done',        step: 2, badge: 'border-green-500/30 bg-green-500/8 text-green-400' },
  canvas_draft:      { label: 'Step 3 in progress', step: 3, badge: 'border-amber-500/30 bg-amber-500/8 text-amber-400' },
  canvas_finalized:  { label: 'Step 3 done',        step: 3, badge: 'border-green-500/30 bg-green-500/8 text-green-400' },
  provisioning:      { label: 'Provisioning…',      step: 4, badge: 'border-accent/30 bg-accent/8 text-accent' },
  live:              { label: 'Live',               step: 5, badge: 'border-green-500/40 bg-green-500/10 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.12)]' },
  failed:            { label: 'Failed',             step: 0, badge: 'border-red-500/30 bg-red-500/8 text-red-400' },
}

function StepDots({ completedStep }) {
  return (
    <div className='flex items-center gap-1'>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-1 w-4 rounded-full transition-colors duration-300 ${
            n <= completedStep ? 'bg-accent shadow-[0_0_6px_rgba(249,115,22,0.4)]' : 'bg-white/[0.08]'
          }`}
        />
      ))}
    </div>
  )
}

function ProjectRow({ project }) {
  const meta    = STATUS_META[project.status] ?? STATUS_META.created
  const isLive   = project.status === 'live'
  const isFailed = project.status === 'failed'
  const isNew    = project.status === 'created'
  const isPrimary = !isLive && !isFailed && !isNew

  return (
    <div className='group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-background/50 px-4 py-3.5 transition-all duration-150 hover:border-white/[0.1] hover:bg-white/[0.02] hover:shadow-md hover:shadow-black/20'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-text-primary'>{project.name}</p>
        {project.repo_full_name ? (
          <p className='mt-0.5 truncate text-xs text-text-muted'>{project.repo_full_name} · {project.repo_branch}</p>
        ) : (
          <p className='mt-0.5 text-xs text-text-muted'>No repository connected</p>
        )}
      </div>

      <StepDots completedStep={meta.step} />

      <span className={`hidden rounded-full border px-2.5 py-0.5 text-xs font-medium md:inline-block ${meta.badge}`}>
        {meta.label}
      </span>

      <Link to={`/app/projects/${project.id}`}>
        <Button variant={isPrimary ? 'primary' : 'secondary'} size='sm'>
          {isLive ? 'Open' : isFailed ? 'Retry' : isNew ? 'Start →' : 'Continue →'}
        </Button>
      </Link>
    </div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    api.listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered   = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.repo_full_name || '').toLowerCase().includes(search.toLowerCase())
  )
  const inProgress = filtered.filter((p) => !['created', 'live', 'failed'].includes(p.status))
  const rest       = filtered.filter((p) =>  ['created', 'live', 'failed'].includes(p.status))

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
          <p className='mt-0.5 text-sm text-text-muted'>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to='/app/projects/new'>
          <Button variant='primary'>
            <i className='ti ti-plus text-sm' />
            New Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className='flex items-center gap-2 rounded-xl border border-white/[0.07] bg-background/60 px-3.5 py-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-accent/40 focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.08)]'>
        <i className='ti ti-search text-sm text-text-muted' />
        <input
          className='flex-1 bg-transparent text-sm text-text-primary caret-accent placeholder:text-text-muted/60 focus:outline-none'
          placeholder='Search by name or repository…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button type='button' onClick={() => setSearch('')} className='text-text-muted transition-colors hover:text-text-primary'>
            <i className='ti ti-x text-xs' />
          </button>
        )}
      </div>

      {loading ? (
        <div className='flex h-48 items-center justify-center'>
          <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]' />
        </div>
      ) : projects.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-gradient-to-b from-white/[0.015] to-transparent py-16 text-center'>
          <div className='grid h-16 w-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]'>
            <i className='ti ti-folder-open text-3xl text-text-muted' />
          </div>
          <p className='mt-4 text-sm font-semibold'>No projects yet</p>
          <p className='mt-1.5 text-xs text-text-muted'>Create your first project to get started.</p>
          <Link to='/app/projects/new'>
            <Button variant='primary' className='mt-5'>Create Project</Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-12 text-center'>
          <i className='ti ti-search text-2xl text-text-muted' />
          <p className='mt-3 text-sm text-text-muted'>No projects match <span className='text-text-primary'>"{search}"</span></p>
        </div>
      ) : (
        <div className='space-y-6'>
          {inProgress.length > 0 && (
            <div>
              <p className='mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-muted'>In progress</p>
              <div className='space-y-2'>
                {inProgress.map((p) => <ProjectRow key={p.id} project={p} />)}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {inProgress.length > 0 && (
                <p className='mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-muted'>All projects</p>
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
