import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Button from '../components/ui/Button'
import useAuth from '../context/useAuth'

const links = [
  { to: '/app/dashboard', label: 'Dashboard', icon: 'DB' },
  { to: '/app/profile', label: 'Profile', icon: 'PR' },
  { to: '/app/projects', label: 'Projects', icon: 'PJ' },
  { to: '/app/settings', label: 'Settings', icon: 'ST' },
  { to: '/', label: 'Docs', icon: 'DC' },
  { to: '/pricing', label: 'Pricing', icon: 'PC' },
]

export default function AppLayout() {
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <div className={`mx-auto grid w-full max-w-6xl gap-6 px-6 py-6 ${collapsed ? 'grid-cols-[88px_1fr]' : 'grid-cols-[220px_1fr]'}`}>
        <aside className='flex min-h-[calc(100vh-3rem)] flex-col rounded-xl border border-border bg-surface p-4'>
          <h2 className={`text-xl font-semibold ${collapsed ? 'text-center' : ''}`}>Clyro</h2>
          <nav className='mt-6 flex flex-1 flex-col gap-2'>
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-accent text-accent bg-accent-soft/40'
                      : 'border-transparent text-text-muted hover:text-text-primary hover:bg-background'
                  }`
                }
              >
                <span className='inline-flex w-6 justify-center text-xs font-semibold'>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className='space-y-2'>
            <Button variant='secondary' size='sm' className='w-full' onClick={() => setCollapsed((prev) => !prev)}>
              {collapsed ? 'Expand' : 'Collapse'}
            </Button>
            <Button variant='ghost' size='sm' className='w-full' onClick={logout}>
              {collapsed ? 'Out' : 'Sign Out'}
            </Button>
          </div>
        </aside>

        <section className='rounded-xl border border-border bg-surface p-6'>
          <Outlet />
        </section>
      </div>
    </div>
  )
}
