import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  House,
  LogOut,
  Settings,
  User,
} from 'lucide-react'
import { api } from '../../api'
import useAuth from '../../context/useAuth'
import clyroLogo from '../../assets/logos/Clyro_logo.png'

const NAV_LINKS = [
  { to: '/app/dashboard', label: 'Home', icon: House },
  { to: '/app/projects', label: 'Projects', icon: Folder },
  { to: '/app/profile', label: 'Profile', icon: User },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

function AnimatedLabel({ children, collapsed, className = '' }) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
        collapsed ? 'max-w-[96px] translate-x-0 opacity-100' : 'max-w-[160px] translate-x-0 opacity-100'
      } ${className}`.trim()}
    >
      {children}
    </span>
  )
}

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

  return (
    <Link
      to='/app/profile'
      title={name || 'Profile'}
      className='flex h-[60px] items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition-all duration-300 ease-in-out hover:border-white/10 hover:bg-white/[0.04]'
    >
      {avatar}
      <div className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${collapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[180px] translate-x-0 opacity-100'}`}>
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
    <div className={`shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      <aside className='sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-3xl border border-white/[0.08] bg-[#050912] px-4 py-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-300 ease-in-out'>
        <Link to='/app/dashboard' className={`flex items-center transition-all duration-300 ease-in-out ${collapsed ? 'justify-center px-0' : 'gap-3 px-2'}`}>
          <div className='flex items-center gap-3'>
            <img
              src={clyroLogo}
              alt='Clyro'
              className='h-10 w-10 object-contain'
            />
            <span
              className={`overflow-hidden whitespace-nowrap text-2xl font-semibold text-white transition-all duration-300 ease-in-out ${
                collapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[120px] translate-x-0 opacity-100'
              }`}
            >
              Clyro
            </span>
          </div>
        </Link>

        <nav className='mt-8 flex flex-1 flex-col gap-2'>
          {NAV_LINKS.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center rounded-2xl border px-4 py-3 transition-all duration-300 ease-in-out ${
                    collapsed ? 'flex-col gap-1' : 'gap-3'
                  } ${
                    isActive
                      ? 'border-[#FFC400]/45 bg-[#FFC400]/10 text-[#FFC400] shadow-[0_0_24px_rgba(255,196,0,0.16)]'
                      : 'border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className='flex h-6 w-6 shrink-0 items-center justify-center'>
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-colors duration-300 ease-in-out ${
                          isActive ? 'text-[#FFC400]' : 'text-white'
                        }`}
                      />
                    </span>
                    <AnimatedLabel collapsed={collapsed} className={`text-center ${collapsed ? 'text-[10px] font-medium leading-none' : 'text-sm font-medium'}`}>
                      {item.label}
                    </AnimatedLabel>
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
            className={`flex h-[48px] w-full items-center rounded-2xl border border-transparent px-4 text-sm font-medium text-white/65 transition-all duration-300 ease-in-out hover:border-white/10 hover:bg-white/[0.04] hover:text-white ${
              collapsed ? 'justify-center gap-0' : 'gap-3'
            }`}
          >
            <span className='flex h-5 w-5 shrink-0 items-center justify-center text-white'>
              {collapsed ? <PanelLeftOpen className='h-5 w-5' /> : <PanelLeftClose className='h-5 w-5' />}
            </span>
            <AnimatedLabel collapsed={collapsed} className='text-sm font-medium text-white/65'>
              {collapsed ? 'Expand' : 'Collapse'}
            </AnimatedLabel>
          </button>

          <div className='mt-3'>
            <SidebarAvatar profile={profile} collapsed={collapsed} />
          </div>

          <button
            type='button'
            onClick={logout}
            title={collapsed ? 'Sign out' : undefined}
            className={`mt-3 flex h-[48px] w-full items-center rounded-2xl border border-transparent px-4 text-sm font-medium text-white/65 transition-all duration-300 ease-in-out hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 ${
              collapsed ? 'justify-center gap-0' : 'gap-3'
            }`}
          >
            <LogOut className='h-5 w-5 shrink-0 text-white' />
            <AnimatedLabel collapsed={collapsed} className='text-sm font-medium'>
              Sign Out
            </AnimatedLabel>
          </button>
        </div>
      </aside>
    </div>
  )
}
