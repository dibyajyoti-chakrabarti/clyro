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

const MOTION_EASE = 'cubic-bezier(.22,1,.36,1)'
const WIDTH_MOTION = {
  transitionProperty: 'width',
  transitionDuration: '420ms',
  transitionTimingFunction: MOTION_EASE,
}

function AnimatedLabel({ children, collapsed, className = '' }) {
  const motionStyle = collapsed
    ? {
        opacity: 0,
        transform: 'translateX(-12px)',
        transitionProperty: 'opacity, transform, max-width',
        transitionDuration: '180ms',
        transitionTimingFunction: 'ease-out',
        transitionDelay: '0ms',
        willChange: 'opacity, transform, max-width',
      }
    : {
        opacity: 1,
        transform: 'translateX(0px)',
        transitionProperty: 'opacity, transform, max-width',
        transitionDuration: '240ms',
        transitionTimingFunction: 'ease-out',
        transitionDelay: '120ms',
        willChange: 'opacity, transform, max-width',
      }

  return (
    <span
      className={`overflow-hidden whitespace-nowrap ${className}`.trim()}
      style={motionStyle}
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
      className='flex h-[60px] items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition-[background-color,border-color,transform] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-white/10 hover:bg-white/[0.04]'
    >
      {avatar}
      <div
        className='min-w-0 flex-1 overflow-hidden whitespace-nowrap'
        style={
          collapsed
            ? {
                maxWidth: '0px',
                opacity: 0,
                transform: 'translateX(-12px)',
                transitionProperty: 'max-width, opacity, transform',
                transitionDuration: '180ms',
                transitionTimingFunction: 'ease-out',
                transitionDelay: '0ms',
                willChange: 'max-width, opacity, transform',
              }
            : {
                maxWidth: '180px',
                opacity: 1,
                transform: 'translateX(0px)',
                transitionProperty: 'max-width, opacity, transform',
                transitionDuration: '240ms',
                transitionTimingFunction: 'ease-out',
                transitionDelay: '120ms',
                willChange: 'max-width, opacity, transform',
              }
        }
      >
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
    <div
      className='shrink-0'
      style={{
        width: collapsed ? '80px' : '260px',
        transitionProperty: 'width',
        transitionDuration: '420ms',
        transitionTimingFunction: MOTION_EASE,
        willChange: 'width',
      }}
    >
      <aside
        className='sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-3xl border border-white/[0.08] bg-[#050912] px-4 py-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
        style={WIDTH_MOTION}
      >
        <Link
          to='/app/dashboard'
          className={`flex items-center transition-[gap,padding,transform] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${collapsed ? 'justify-center px-0' : 'gap-3 px-2'}`}
          style={{ willChange: 'transform, gap' }}
        >
          <div className='flex items-center gap-3'>
            <img
              src={clyroLogo}
              alt='Clyro'
              className='h-10 w-10 object-contain'
            />
            <span
              className={`overflow-hidden whitespace-nowrap text-2xl font-semibold text-white transition-[opacity,transform,max-width] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${
                collapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[120px] translate-x-0 opacity-100'
              }`}
              style={
                collapsed
                  ? {
                      transitionDelay: '0ms',
                      willChange: 'opacity, transform, max-width',
                    }
                  : {
                      transitionDelay: '120ms',
                      willChange: 'opacity, transform, max-width',
                    }
              }
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
                  `group flex items-center rounded-2xl border px-4 py-3 transition-[background-color,border-color,color,transform,gap,padding] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${
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
                    <span className='flex h-6 w-6 shrink-0 items-center justify-center' style={{ willChange: 'transform' }}>
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-colors duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${
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
            className={`flex h-[48px] w-full items-center rounded-2xl border border-transparent px-4 text-sm font-medium text-white/65 transition-[background-color,border-color,color,transform,width,gap,padding] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-white/10 hover:bg-white/[0.04] hover:text-white ${
              collapsed ? 'justify-center gap-0' : 'gap-3'
            }`}
            style={{ willChange: 'transform, width' }}
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
            className={`mt-3 flex h-[48px] w-full items-center rounded-2xl border border-transparent px-4 text-sm font-medium text-white/65 transition-[background-color,border-color,color,transform,gap,padding] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 ${
              collapsed ? 'justify-center gap-0' : 'gap-3'
            }`}
            style={{ willChange: 'transform' }}
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
