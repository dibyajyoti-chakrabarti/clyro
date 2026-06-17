import { Link, Outlet, useParams } from 'react-router-dom'
import { Copy } from 'lucide-react'
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
      <header className='sticky top-5 z-30 mb-5 px-6'>
        <div className='relative h-[76px] overflow-hidden rounded-[24px] border border-[#E8B84B]/[0.18] bg-[rgba(8,12,20,0.65)] shadow-[0_15px_60px_rgba(0,0,0,0.45)] backdrop-blur-[24px]'>
          <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(232,184,75,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.05),transparent_25%)]' />
          <div className='relative flex h-full items-center justify-between px-6'>
            <p className='cursor-pointer text-[22px] font-bold text-white transition-opacity duration-[250ms] hover:opacity-85'>Clyro</p>

            <div className='flex items-center gap-3'>
              <span className='text-[18px] font-medium text-white'>Project</span>
              <span className='text-[18px] font-semibold text-[#E8B84B]'>Project {id || 'ABC'}</span>
              <Copy className='h-4 w-4 text-[#E8B84B] transition-transform duration-[250ms] hover:-translate-y-0.5 hover:rotate-12' />
            </div>

            <Link to='/app/projects'>
              <Button
                variant='ghost'
                size='sm'
                className='h-[48px] rounded-[16px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] px-[22px] text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:border-[#E8B84B] hover:bg-[rgba(232,184,75,0.08)]'
              >
                Exit to Projects
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className='w-screen h-[calc(100vh-73px)] overflow-hidden'>
        <Outlet />
      </main>
    </div>
  )
}
