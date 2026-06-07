import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
} from 'lucide-react'
import { api } from '../../api'
import useAuth from '../../context/useAuth'
import clyroLogo from '../../assets/logos/Clyro_logo.png'

const NAV_LINKS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/projects', label: 'Projects', icon: FolderOpen },
  { to: '/app/profile', label: 'Profile', icon: User },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

function SidebarAvatar({ profile, collapsed }) {
  const name = profile?.name || ''
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const avatar = profile?.avatar_url ? (
    <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10'>
      <img
        src={profile.avatar_url}
        alt={name}
        referrerPolicy='no-referrer'
        className='h-full w-full rounded-full object-cover'
      />
    </div>
  ) : (
    <div className='grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(255,196,0,0.24),rgba(255,196,0,0.08))] text-sm font-semibold text-white ring-1 ring-white/10'>
      {initials}
    </div>
  )

  if (collapsed) {
    return (
      <Link
        to='/app/profile'
        title={name || 'Profile'}
        className='flex items-center justify-center rounded-2xl border border-transparent p-1.5 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]'
      >
        {avatar}
      </Link>
    )
  }

  return (
    <Link
      to='/app/profile'
      className='flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]'
    >
      {avatar}
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-white'>{name || 'Profile'}</p>
        <p className='truncate text-xs text-white/65'>{profile?.email || ''}</p>
      </div>
    </Link>
  )
}

export default function Sidebar() {
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.getMe().then(setProfile).catch(() => {})
  }, [])

  return (
    <div className={`shrink-0 transition-all duration-300 ${collapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      <aside className='sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-3xl border border-white/[0.08] bg-[#050912] px-4 py-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-300'>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-2'}`}>
          {collapsed ? (
            <div className='flex items-center justify-center'>
              <img
                src={clyroLogo}
                alt='Clyro'
                className='h-10 w-10 object-contain'
              />
            </div>
          ) : (
            <div className='flex items-center gap-3'>
              <img
                src={clyroLogo}
                alt='Clyro'
                className='h-10 w-10 object-contain'
              />
              <span className='text-2xl font-semibold text-white'>
                Clyro
              </span>
            </div>
          )}
        </div>

        <nav className='mt-8 flex flex-1 flex-col gap-2'>
          {NAV_LINKS.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center rounded-2xl border px-4 py-3 transition-all duration-300 ${
                    collapsed ? 'justify-center' : 'gap-3'
                  } ${
                    isActive
                      ? 'border-[#FFC400]/45 bg-[#FFC400]/10 text-[#FFC400] shadow-[0_0_24px_rgba(255,196,0,0.16)]'
                      : 'border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-all duration-300 ${
                        isActive ? 'text-[#FFC400]' : 'text-white'
                      }`}
                    />
                    {!collapsed && <span className='text-sm font-medium'>{item.label}</span>}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className='mt-6 border-t border-white/[0.08] pt-4'>
          <button
            type='button'
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/65 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white ${
              collapsed ? 'justify-center' : 'gap-3'
            }`}
          >
            <span className='shrink-0 text-base font-semibold text-white'>{collapsed ? '>>' : '<<'}</span>
            {!collapsed && <span>Collapse</span>}
          </button>

          <div className='mt-3'>
            <SidebarAvatar profile={profile} collapsed={collapsed} />
          </div>

          <button
            type='button'
            onClick={logout}
            title={collapsed ? 'Sign out' : undefined}
            className={`mt-3 flex w-full items-center rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/65 transition-all duration-300 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 ${
              collapsed ? 'justify-center' : 'gap-3'
            }`}
          >
            <LogOut className='h-5 w-5 shrink-0 text-white' />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </div>
  )
}
