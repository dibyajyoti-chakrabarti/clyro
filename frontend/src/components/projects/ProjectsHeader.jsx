import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'

export default function ProjectsHeader({ count = 0 }) {
  return (
    <div className='flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-surface/40 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-md sm:flex-row sm:items-end sm:justify-between'>
      <div className='space-y-1'>
        <p className='text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/80'>Projects</p>
        <div className='flex flex-wrap items-center gap-3'>
          <h1 className='text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl'>Projects</h1>
          <span className='rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-text-muted'>
            All Projects ({count})
          </span>
        </div>
        <p className='max-w-2xl text-sm text-text-muted'>Build, manage and deploy your cloud systems.</p>
      </div>

      <Link to='/app/projects/new'>
        <Button variant='primary' className='w-full sm:w-auto'>
          <Plus className='h-4 w-4' />
          New Project
        </Button>
      </Link>
    </div>
  )
}
