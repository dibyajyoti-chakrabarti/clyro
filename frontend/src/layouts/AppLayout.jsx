import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'

export default function AppLayout() {
  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <div className='grid min-h-screen w-full grid-cols-[auto_1fr] gap-4 p-4'>
        <Sidebar />
        <main className='min-h-[calc(100vh-2rem)] rounded-2xl border border-white/[0.07] bg-surface p-6 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
