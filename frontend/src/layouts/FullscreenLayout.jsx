import { Link, Outlet, useParams } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function FullscreenLayout() {
  const { id } = useParams()
  const isCreateProjectRoute = id === 'new'

  if (isCreateProjectRoute) {
    return (
      <div className='min-h-screen bg-background text-text-primary'>
        <main className='min-h-screen w-screen overflow-hidden'>
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <header className='border-b border-border bg-surface'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4'>
          <p className='text-xl font-semibold'>Clyro</p>
          <p className='text-base font-semibold'>Project {id || 'ABC'}</p>
          <Link to='/app/projects'>
            <Button variant='ghost' size='sm'>Exit to Projects</Button>
          </Link>
        </div>
      </header>
      <main className='mx-auto min-h-[calc(100vh-73px)] w-full max-w-6xl px-6 py-6'>
        <Outlet />
      </main>
    </div>
  )
}
