import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Rocket } from 'lucide-react'
import Button from '../../components/ui/Button'
import { api } from '../../api'
import { stepConfig } from './ProjectWizard/constants/stepConfig'

export default function CreateProject() {
  const navigate = useNavigate()
  const [projectName, setProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [createError, setCreateError] = useState('')

  const handleCreateProject = async (e) => {
    e.preventDefault()
    const trimmed = projectName.trim()
    if (!trimmed) return
    setCreatingProject(true)
    setCreateError('')
    try {
      const project = await api.createProject(trimmed)
      navigate(`/app/projects/${project.id}`, { replace: true })
    } catch (err) {
      setCreateError(err.message || 'Failed to create project')
    } finally {
      setCreatingProject(false)
    }
  }

  return (
    <div className='flex min-h-[calc(100vh-121px)] items-center justify-center'>
      <div className='w-full max-w-xl'>
        <div className='overflow-hidden rounded-2xl border border-white/[0.08] bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)]'>
          <div className='border-b border-white/[0.06] bg-gradient-to-b from-accent/[0.08] to-transparent px-8 pt-8 pb-7'>
            <div className='grid h-12 w-12 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent'>
              <Rocket className='h-6 w-6' />
            </div>
            <h1 className='mt-5 text-2xl font-semibold tracking-tight'>Name your project</h1>
            <p className='mt-2 max-w-md text-sm text-text-muted'>
              We&apos;ll connect your repo, detect your stack, and generate cloud infrastructure tailored to it â€” in five guided steps.
            </p>
          </div>

          <form onSubmit={handleCreateProject} className='px-8 py-7'>
            <label htmlFor='project-name' className='block text-sm font-medium text-text-primary'>
              Project name
            </label>
            <input
              id='project-name'
              className='mt-1.5 w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary caret-accent transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20'
              placeholder='My awesome app'
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
            />
            {createError ? (
              <p className='mt-2 flex items-center gap-1.5 text-sm text-danger'>
                <AlertTriangle className='h-3.5 w-3.5' />
                {createError}
              </p>
            ) : null}
            <Button
              variant='primary'
              className='mt-5 w-full'
              size='lg'
              type='submit'
              disabled={!projectName.trim() || creatingProject}
            >
              {creatingProject ? 'Creatingâ€¦' : 'Create project'}
              {!creatingProject ? <ArrowRight className='h-4 w-4' /> : null}
            </Button>
          </form>
        </div>

        <div className='mt-5 px-2'>
          <p className='text-[11px] font-semibold uppercase tracking-widest text-text-muted'>What happens next</p>
          <ol className='mt-3 grid gap-2 sm:grid-cols-2'>
            {stepConfig.map((item) => (
              <li key={item.number} className='flex items-center gap-2.5 text-sm text-text-muted'>
                <span className='grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border bg-background text-[11px] font-semibold text-text-muted'>
                  {item.number}
                </span>
                <span className='truncate'>{item.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
