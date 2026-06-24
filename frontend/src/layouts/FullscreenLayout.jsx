import { Outlet, useParams } from 'react-router-dom'

export default function FullscreenLayout() {
  const { id } = useParams()
  const isCreateProjectRoute = id === 'new'

  if (isCreateProjectRoute) {
    return (
      <div className='min-h-screen w-full max-w-full overflow-x-hidden bg-background text-text-primary box-border'>
        <main className='min-h-screen w-full max-w-full overflow-x-hidden box-border'>
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className='min-h-screen w-full max-w-full overflow-x-hidden bg-background text-text-primary box-border'>
      <main className='w-full max-w-full overflow-x-hidden box-border'>
        <Outlet />
      </main>
    </div>
  )
}
