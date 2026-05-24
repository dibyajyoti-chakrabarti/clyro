import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function linkClass({ isActive }) {
  return isActive
    ? 'border-l-2 border-orange-500 px-3 py-2 text-orange-500 font-semibold'
    : 'border-l-2 border-transparent px-3 py-2 text-[#F5F5F5] hover:text-orange-500'
}

export default function AppLayout() {
  const { logout } = useAuth()

  return (
    <div className='min-h-screen bg-[#0E0E0E] text-[#F5F5F5]'>
      <div className='mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]'>
        <aside className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 shadow-[0_0_0_1px_#2A2A2A]'>
          <h2 className='mb-4 text-lg font-bold text-[#F5F5F5]'>Clyro App</h2>
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
            className='mt-6 w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm font-semibold text-[#F5F5F5] hover:border-orange-500 hover:text-orange-500'
          >
            Sign Out (Mock)
          </button>
        </aside>

        <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-6 shadow-[0_0_0_1px_#2A2A2A]'>
          <Outlet />
        </section>
      </div>
    </div>
  )
}
