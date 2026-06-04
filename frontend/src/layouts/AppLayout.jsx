import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import useAuth from '../context/useAuth'

const NAV_LINKS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
  { to: '/app/projects',  label: 'Projects',  icon: 'ti ti-folder' },
  { to: '/app/profile',   label: 'Profile',   icon: 'ti ti-user' },
  { to: '/app/settings',  label: 'Settings',  icon: 'ti ti-settings' },
]

export default function AppLayout() {
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <div className={`mx-auto grid w-full max-w-6xl gap-6 px-6 py-6 ${collapsed ? 'grid-cols-[64px_1fr]' : 'grid-cols-[220px_1fr]'}`}>

        <aside className='flex min-h-[calc(100vh-3rem)] flex-col rounded-xl border border-border bg-surface p-3'>
          {!collapsed && (
            <div className='px-2 py-1'>
              <h2 className='text-lg font-semibold tracking-tight'>Clyro</h2>
            </div>
          )}
          {collapsed && (
            <div className='flex justify-center py-1'>
              <span className='text-lg font-semibold'>C</span>
            </div>
          )}

          <nav className='mt-4 flex flex-1 flex-col gap-0.5'>
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-muted hover:bg-background hover:text-text-primary'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <i className={`${item.icon} text-base`} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className='mt-2 space-y-0.5 border-t border-border pt-2'>
            <button
              type='button'
              onClick={() => setCollapsed((p) => !p)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? 'Expand sidebar' : undefined}
            >
              <i className={`ti ${collapsed ? 'ti-layout-sidebar-right' : 'ti-layout-sidebar-left'} text-base`} />
              {!collapsed && <span>Collapse</span>}
            </button>
            <button
              type='button'
              onClick={logout}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? 'Sign out' : undefined}
            >
              <i className='ti ti-logout text-base' />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        <section className='min-h-[calc(100vh-3rem)] rounded-xl border border-border bg-surface p-6'>
          <Outlet />
        </section>
      </div>
    </div>
  )
}
