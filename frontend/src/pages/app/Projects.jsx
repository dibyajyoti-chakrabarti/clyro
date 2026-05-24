import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'

export default function Projects() {
  const projects = [
    { id: 1, name: 'Project 1', type: 'Monolithic', modified: '54 mins ago' },
    { id: 2, name: 'Project 2', type: 'Monolithic', modified: '1 day ago' },
    { id: 3, name: 'Project 3', type: 'Microservice', modified: '2 days ago' },
  ]
  const showEmptyState = false

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
        <Link to='/app/projects/new'>
          <Button variant='primary'>New Project</Button>
        </Link>
      </div>

      <Card>
        <div className='grid gap-4 md:grid-cols-[1fr_auto_auto]'>
          <Input label='Search Projects' placeholder='Search by project name' />
          <Button variant='ghost' className='h-fit self-end'>
            Filter
          </Button>
          <Button variant='ghost' className='h-fit self-end'>
            Sort
          </Button>
        </div>
      </Card>

      {showEmptyState ? (
        <Card>
          <div className='py-6 text-center'>
            <p className='text-base font-semibold'>No projects yet</p>
            <p className='mt-2 text-sm font-normal text-text-muted'>Create your first project to get started.</p>
            <Link to='/app/projects/new'>
              <Button variant='primary' className='mt-4'>
                Create Project
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className='text-xl font-semibold'>Recently Visited</h2>
          <div className='mt-4 space-y-2'>
            {projects.map((project) => (
              <div key={project.id} className='grid items-center gap-3 rounded-md border border-border bg-background px-3 py-3 md:grid-cols-[1.2fr_1fr_1fr_auto]'>
                <p className='text-base font-semibold'>{project.name}</p>
                <p className='text-sm font-normal text-text-muted'>{project.type}</p>
                <p className='text-sm font-normal text-text-muted'>{project.modified}</p>
                <Link to={`/app/projects/${project.id}`}>
                  <Button variant='secondary' size='sm'>Open</Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
