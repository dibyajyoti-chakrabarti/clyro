import { NavLink, Outlet } from 'react-router-dom'
import Button from '../components/ui/Button'

function navLinkClass({ isActive }) {
  return isActive ? 'text-accent' : ''
}

export default function PublicLayout() {
  return (
    <div className='min-h-screen bg-background text-text-primary'>
      <header className='border-b border-border'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4'>
          <NavLink to='/' className='text-xl font-semibold'>
            Clyro
          </NavLink>
          <nav className='flex items-center gap-2'>
            <NavLink to='/' className={navLinkClass}>
              <Button variant='ghost' size='sm'>Products</Button>
            </NavLink>
            <NavLink to='/' className={navLinkClass}>
              <Button variant='ghost' size='sm'>Docs</Button>
            </NavLink>
            <NavLink to='/pricing' className={navLinkClass}>
              <Button variant='ghost' size='sm'>Pricing</Button>
            </NavLink>
          </nav>
          <div className='flex items-center gap-2'>
            <NavLink to='/login'>
              <Button variant='ghost' size='sm'>Sign In</Button>
            </NavLink>
            <NavLink to='/signup'>
              <Button variant='primary' size='sm'>Sign Up</Button>
            </NavLink>
          </div>
        </div>
      </header>

      <main className='mx-auto w-full max-w-6xl px-6 py-8'>
        <Outlet />
      </main>
    </div>
  )
}
