import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import useAuth from '../context/useAuth'
import { api } from '../api'

const NAV_LINKS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: 'ti ti-layout-dashboard' },
  { to: '/app/projects',  label: 'Projects',  icon: 'ti ti-folder' },
  { to: '/app/profile',   label: 'Profile',   icon: 'ti ti-user' },
  { to: '/app/settings',  label: 'Settings',  icon: 'ti ti-settings' },
]

function SidebarAvatar({ profile, collapsed }) {
  const name = profile?.name || ''
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  const avatar = profile?.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={name}
      referrerPolicy="no-referrer"
      className='h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-accent/20'
    />
  ) : (
    <div className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-[11px] font-semibold text-accent ring-1 ring-accent/20'>
      {initials}
    </div>
  )

  if (collapsed) return (
    <Link to='/app/profile' title={name} className='flex justify-center rounded-lg p-1 transition-colors hover:bg-white/[0.04]'>
      {avatar}
    </Link>
  )

  return (
    <Link to='/app/profile' className='flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]'>
      {avatar}
      <div className='min-w-0 flex-1'>
        <p className='truncate text-xs font-medium text-text-primary'>{name || '—'}</p>
        <p className='truncate text-[10px] text-text-muted'>{profile?.email || ''}</p>
      </div>
    </Link>
  )
}

export default function AppLayout() {
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.getMe().then(setProfile).catch(() => {})
  }, [])

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
            <SidebarAvatar profile={profile} collapsed={collapsed} />
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
