import { Link, NavLink, Outlet } from 'react-router-dom'

function navClass({ isActive }) {
  return isActive
    ? 'text-sky-600 font-semibold'
    : 'text-slate-700 hover:text-sky-600 transition-colors'
}

export default function PublicLayout() {
  return (
    <div className='min-h-screen bg-slate-50 text-slate-900'>
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4'>
          <Link to='/' className='text-xl font-bold text-slate-900'>
            Clyro
          </Link>

          <nav className='flex items-center gap-6'>
            <Link to='/' className='text-slate-700 hover:text-sky-600 transition-colors'>
              Products
            </Link>
            <Link to='/' className='text-slate-700 hover:text-sky-600 transition-colors'>
              Docs
            </Link>
            <NavLink to='/pricing' className={navClass}>
              Pricing
            </NavLink>
          </nav>

          <div className='flex items-center gap-3'>
            <NavLink to='/login' className={navClass}>
              Sign In
            </NavLink>
            <NavLink
              to='/signup'
              className='rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700'
            >
              Sign Up
            </NavLink>
          </div>
        </div>
      </header>

      <main className='mx-auto w-full max-w-6xl px-4 py-10'>
        <Outlet />
      </main>
    </div>
  )
}
