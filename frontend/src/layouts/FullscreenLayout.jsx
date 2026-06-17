import { Outlet, useParams } from 'react-router-dom'

export default function FullscreenLayout() {
  const { id } = useParams()
  const isCreateProjectRoute = id === 'new'

  if (isCreateProjectRoute) {
    return (
      <div className='min-h-screen bg-background text-text-primary'>
        <main className='min-h-screen w-screen'>
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <main className='w-screen'>
        <Outlet />
      </main>
    </div>
  )
}
