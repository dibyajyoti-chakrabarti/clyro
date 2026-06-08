import { ChevronRight, MoreVertical, Folder, Rocket, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import ProjectStatusBadge from './ProjectStatusBadge'
import githubIcon from '../../assets/logos/github-fill.svg'

function formatDate(value) {
  if (!value) return 'Recently updated'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently updated'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function ProjectCard({ project }) {
  const status = project.status || 'default'
  const iconClassName = 'h-5 w-5'

  const renderProjectIcon = () => {
    if (status === 'live') {
      return (
        <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-green-500/20 bg-green-500/10 text-green-400'>
          <Rocket className={iconClassName} />
        </div>
      )
    }

    if (status === 'failed') {
      return (
        <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400'>
          <AlertTriangle className={iconClassName} />
        </div>
      )
    }

    if (status === 'repo_connected') {
      return (
        <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10'>
          <img src={githubIcon} alt='GitHub' className='h-5 w-5' />
        </div>
      )
    }

    return (
      <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent'>
        <Folder className={iconClassName} />
      </div>
    )
  }

  return (
    <article className='group rounded-2xl border border-white/[0.08] bg-surface/40 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 hover:shadow-[0_20px_70px_rgba(251,191,36,0.12)]'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex min-w-0 items-start gap-4'>
          {renderProjectIcon()}

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

          <Button variant='ghost' size='sm' className='h-10 w-10 rounded-lg border border-white/[0.08] px-0 hover:border-amber-400/30 hover:bg-white/[0.03]'>
            <MoreVertical className='h-4 w-4' />
          </Button>

          <Link to={`/app/projects/${project.id}`}>
            <Button variant='secondary' size='sm' className='h-10 w-10 rounded-lg border border-white/[0.08] px-0 hover:border-amber-400/30 hover:bg-white/[0.03]'>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
