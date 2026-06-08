import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import ProjectStatusBadge from './ProjectStatusBadge'

function formatDate(value) {
  if (!value) return 'Recently updated'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently updated'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function ProjectCard({ project }) {
  const status = project.status || 'default'

  return (
    <article className='group rounded-2xl border border-white/[0.08] bg-surface/40 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 hover:shadow-[0_20px_70px_rgba(251,191,36,0.12)]'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex min-w-0 items-start gap-4'>
          <div className='grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-background/70 text-amber-300'>
            <i className='ti ti-box text-xl' />
          </div>

          <div className='min-w-0 space-y-2'>
            <div className='min-w-0'>
              <h3 className='truncate text-base font-semibold text-text-primary'>{project.name}</h3>
              <p className='mt-1 text-sm text-text-muted'>
                {project.description || project.repo_full_name || 'No description available.'}
              </p>
            </div>
            <ProjectStatusBadge status={status} />
          </div>
        </div>

        <div className='flex items-center gap-3 md:shrink-0'>
          <div className='text-right'>
            <p className='text-xs uppercase tracking-[0.18em] text-text-muted'>Updated</p>
            <p className='mt-1 text-sm text-text-primary'>{formatDate(project.updated_at || project.updatedAt || project.modified_at)}</p>
            <p className='mt-1 text-xs text-text-muted'>{project.environment || 'Environment not set'}</p>
          </div>

          <Button variant='ghost' size='sm' className='px-3'>
            <i className='ti ti-dots-vertical text-sm' />
          </Button>

          <Link to={`/app/projects/${project.id}`}>
            <Button variant='secondary' size='sm' className='px-3'>
              <i className='ti ti-chevron-right text-sm' />
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
