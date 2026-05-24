import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function linkClass({ isActive }) {
  return isActive
    ? 'rounded-md bg-sky-100 px-3 py-2 text-sky-700 font-semibold'
    : 'rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100'
}

export default function AppLayout() {
  const { logout } = useAuth()

  return (
    <div className='min-h-screen bg-slate-50'>
      <div className='mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]'>
        <aside className='rounded-xl border border-slate-200 bg-white p-4'>
          <h2 className='mb-4 text-lg font-bold text-slate-900'>Clyro App</h2>
          <nav className='flex flex-col gap-2'>
            <NavLink to='/app/dashboard' className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to='/app/profile' className={linkClass}>
              Profile
            </NavLink>
            <NavLink to='/app/projects' className={linkClass}>
              Projects
            </NavLink>
            <NavLink to='/app/settings' className={linkClass}>
              Settings
            </NavLink>
            <NavLink to='/' className={linkClass}>
              Docs
            </NavLink>
            <NavLink to='/pricing' className={linkClass}>
              Pricing
            </NavLink>
          </nav>

          <button
            type='button'
            onClick={logout}
            className='mt-6 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700'
          >
            Sign Out (Mock)
          </button>
        </aside>

        <section className='rounded-xl border border-slate-200 bg-white p-6'>
          <Outlet />
        </section>
      </div>
    </div>
  )
}
