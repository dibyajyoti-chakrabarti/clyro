import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'

export default function AppLayout() {
  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <div
        className='grid min-h-screen w-full gap-[4px] p-[4px]'
        style={{
          gridTemplateColumns: 'auto 1fr',
          transitionProperty: 'grid-template-columns',
          transitionDuration: '420ms',
          transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
          willChange: 'grid-template-columns',
        }}
      >
        <Sidebar />
        <main
          className='min-h-[calc(100vh-2rem)] rounded-2xl border border-white/[0.07] bg-surface p-6 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'
          style={{
            transitionProperty: 'width, transform, flex-basis',
            transitionDuration: '420ms',
            transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
            willChange: 'width, transform',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
