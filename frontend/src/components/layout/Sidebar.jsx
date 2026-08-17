import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  House,
  LogOut,
  Settings,
  User,
  X,
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

// In expanded mode: label sits beside icon (row).
// In collapsed mode: label sits below icon (col) — always visible, smaller font.
function AnimatedLabel({ children, collapsed, className = '' }) {
  const motionStyle = collapsed
    ? {
        opacity: 1,
        transform: 'translateY(0)',
        transitionProperty: 'opacity, transform',
        transitionDuration: '240ms',
        transitionTimingFunction: 'ease-out',
        transitionDelay: '80ms',
        willChange: 'opacity, transform',
      }
    : {
        opacity: 1,
        transform: 'translateX(0px)',
        transitionProperty: 'opacity, transform',
        transitionDuration: '240ms',
        transitionTimingFunction: 'ease-out',
        transitionDelay: '120ms',
        willChange: 'opacity, transform',
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

function SidebarAvatar({ profile, collapsed, onNavigate }) {
  const name = profile?.name || ''
  const firstName = name.split(' ')[0] || 'Profile'
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const avatarEl = profile?.avatar_url ? (
    <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10'>
      <img
        src={profile.avatar_url}
        alt={name}
        referrerPolicy='no-referrer'
        className='h-full w-full rounded-full object-cover'
      />
    </div>
  ) : (
    <div className='grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(255,196,0,0.24),rgba(255,196,0,0.08))] text-sm font-semibold text-white ring-1 ring-white/10'>
      {initials}
    </div>
  )

  if (collapsed) {
    return (
      <Link
        to='/app/profile'
        title={name || 'Profile'}
        onClick={onNavigate}
        className='flex w-full flex-col items-center gap-1 rounded-2xl border border-transparent px-0 py-2 transition-[background-color,border-color,transform] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-white/10 hover:bg-white/[0.04]'
      >
        {avatarEl}
        <span className='max-w-full truncate text-center text-[10px] font-medium leading-none text-white/65'>
          {firstName}
        </span>
      </Link>
    )
  }

  return (
    <Link
      to='/app/profile'
      title={name || 'Profile'}
      onClick={onNavigate}
      className='flex h-[60px] items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition-[background-color,border-color,transform] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-white/10 hover:bg-white/[0.04]'
    >
      <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10'>
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={name}
            referrerPolicy='no-referrer'
            className='h-full w-full rounded-full object-cover'
          />
        ) : (
          <div className='grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(255,196,0,0.24),rgba(255,196,0,0.08))] text-sm font-semibold text-white ring-1 ring-white/10'>
            {initials}
          </div>
        )}
      </div>
      <div className='min-w-0 flex-1 overflow-hidden whitespace-nowrap'>
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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    api.getMe().then(setProfile).catch(() => {})
  }, [])

  useEffect(() => {
    if (!mobileOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <div className='fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-4 md:hidden'>
        <button
          type='button'
          aria-label='Open menu'
          onClick={() => setMobileOpen(true)}
          className='grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-shell text-white shadow-[0_12px_30px_rgba(0,0,0,0.4)]'
        >
          <Menu className='h-5 w-5' />
        </button>

        <Link
          to='/app/dashboard'
          aria-label='Go to dashboard'
          className='grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-shell shadow-[0_12px_30px_rgba(0,0,0,0.4)]'
        >
          <img src={clyroLogo} alt='Clyro' className='h-7 w-7 object-contain' />
        </Link>
      </div>

      <div
        className='fixed inset-0 z-50 md:hidden'
        aria-hidden={!mobileOpen}
        style={{ pointerEvents: mobileOpen ? 'auto' : 'none' }}
      >
        <div
          onClick={closeMobile}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Navigation menu'
          className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-white/[0.08] bg-shell px-4 pb-6 pt-4 text-white shadow-[0_-24px_80px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${
            mobileOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className='flex items-center justify-between px-1'>
            <Link to='/app/dashboard' onClick={closeMobile} className='flex items-center gap-3'>
              <img src={clyroLogo} alt='Clyro' className='h-9 w-9 object-contain' />
              <span className='text-xl font-semibold text-white'>Clyro</span>
            </Link>
            <button
              type='button'
              aria-label='Close menu'
              onClick={closeMobile}
              className='grid h-9 w-9 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          <nav className='mt-6 flex flex-col gap-1 overflow-y-auto'>
            {NAV_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-[#FFC400]/45 bg-[#FFC400]/10 text-[#FFC400]'
                        : 'border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                    }`
                  }
                >
                  <Icon className='h-5 w-5 shrink-0' />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className='mt-4 border-t border-white/[0.08] pt-4'>
            <SidebarAvatar profile={profile} collapsed={false} onNavigate={closeMobile} />

            <button
              type='button'
              onClick={() => {
                closeMobile()
                logout()
              }}
              className='mt-3 flex h-[48px] w-full items-center gap-3 rounded-2xl border border-transparent px-4 text-sm font-medium text-white/65 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300'
            >
              <LogOut className='h-5 w-5 shrink-0' />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div
        className='hidden shrink-0 md:block'
        style={{
          width: collapsed ? '80px' : '260px',
          transitionProperty: 'width',
          transitionDuration: '420ms',
          transitionTimingFunction: MOTION_EASE,
          willChange: 'width',
        }}
      >
      <aside
        className='sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-3xl border border-white/[0.08] bg-shell px-4 py-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
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
                title={undefined}
                className={({ isActive }) =>
                  `group flex items-center rounded-2xl border transition-[background-color,border-color,color,transform,gap,padding] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${
                    collapsed ? 'flex-col justify-center gap-1 px-0 py-2.5' : 'gap-3 px-4 py-3'
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
                    <AnimatedLabel
                      collapsed={collapsed}
                      className={`text-center ${collapsed ? 'text-[10px] font-medium leading-none' : 'text-sm font-medium'}`}
                    >
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
            className={`flex w-full items-center rounded-2xl border border-transparent font-medium text-white/65 transition-[background-color,border-color,color,transform,width,gap,padding] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-white/10 hover:bg-white/[0.04] hover:text-white ${
              collapsed ? 'flex-col justify-center gap-1 px-0 py-2.5' : 'h-[48px] gap-3 px-4 text-sm'
            }`}
            style={{ willChange: 'transform, width' }}
          >
            <span className='flex h-5 w-5 shrink-0 items-center justify-center text-white'>
              {collapsed ? <PanelLeftOpen className='h-5 w-5' /> : <PanelLeftClose className='h-5 w-5' />}
            </span>
            <AnimatedLabel
              collapsed={collapsed}
              className={`${collapsed ? 'text-[10px] font-medium leading-none text-white/65' : 'text-sm font-medium text-white/65'}`}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </AnimatedLabel>
          </button>

          <div className='mt-3'>
            <SidebarAvatar profile={profile} collapsed={collapsed} />
          </div>

          <button
            type='button'
            onClick={logout}
            title={undefined}
            className={`mt-3 flex w-full items-center rounded-2xl border border-transparent font-medium text-white/65 transition-[background-color,border-color,color,transform,gap,padding] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 ${
              collapsed ? 'flex-col justify-center gap-1 px-0 py-2.5' : 'h-[48px] gap-3 px-4 text-sm'
            }`}
            style={{ willChange: 'transform' }}
          >
            <LogOut className='h-5 w-5 shrink-0 text-white' />
            <AnimatedLabel
              collapsed={collapsed}
              className={`${collapsed ? 'text-[10px] font-medium leading-none' : 'text-sm font-medium'}`}
            >
              Sign Out
            </AnimatedLabel>
          </button>
        </div>
      </aside>
      </div>
    </>
  )
}
