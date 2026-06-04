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
      <div
        className={`mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 transition-[grid-template-columns] duration-200 ${
          collapsed ? 'grid-cols-[56px_1fr]' : 'grid-cols-[224px_1fr]'
        }`}
      >
        {/* Sidebar */}
        <aside className='sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-2xl border border-white/[0.07] bg-surface shadow-xl shadow-black/30 ring-1 ring-inset ring-white/[0.04]'>
          {/* Logo */}
          <div className={`flex h-14 shrink-0 items-center border-b border-white/[0.06] px-3 ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? (
              <div className='grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-amber-600 shadow-[0_0_16px_rgba(249,115,22,0.4)]'>
                <span className='text-sm font-bold text-black'>C</span>
              </div>
            ) : (
              <div className='flex items-center gap-2.5'>
                <div className='grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent to-amber-600 shadow-[0_0_12px_rgba(249,115,22,0.35)]'>
                  <span className='text-xs font-bold text-black'>C</span>
                </div>
                <span className='text-[15px] font-semibold tracking-tight'>Clyro</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className='flex flex-1 flex-col gap-0.5 overflow-y-auto p-2'>
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(249,115,22,0.2)]'
                      : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                  }`
                }
              >
                <i className={`${item.icon} text-[15px] shrink-0`} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Bottom actions */}
          <div className='shrink-0 border-t border-white/[0.06] p-2 space-y-0.5'>
            <button
              type='button'
              onClick={() => setCollapsed((p) => !p)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-text-muted transition-all duration-150 hover:bg-white/[0.04] hover:text-text-primary ${collapsed ? 'justify-center' : ''}`}
            >
              <i className={`ti ${collapsed ? 'ti-arrow-bar-right' : 'ti-arrow-bar-left'} text-[15px] shrink-0`} />
              {!collapsed && <span>Collapse</span>}
            </button>
            <button
              type='button'
              onClick={logout}
              title={collapsed ? 'Sign out' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-text-muted transition-all duration-150 hover:bg-danger/8 hover:text-danger ${collapsed ? 'justify-center' : ''}`}
            >
              <i className='ti ti-logout text-[15px] shrink-0' />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className='min-h-[calc(100vh-2rem)] rounded-2xl border border-white/[0.07] bg-surface p-6 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
