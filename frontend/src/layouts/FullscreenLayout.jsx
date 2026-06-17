import { Outlet, useParams } from 'react-router-dom'

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
      <main className='h-screen w-screen overflow-hidden'>
        <Outlet />
      </main>
    </div>
  )
}
