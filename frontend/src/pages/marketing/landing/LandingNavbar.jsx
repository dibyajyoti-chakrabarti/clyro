import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import clyroLogo from '../../../assets/logos/Clyro_logo.png'

/* Landing-only navbar. Deliberately a copy of components/layout/Navbar rather than a
   change to it — that one is still rendered for /pricing, /login and /signup. */

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Resources', href: '#resources' },
  { label: 'Company', href: '#company' },
]

export default function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className='sticky top-0 z-50 w-full border-b border-black/[0.06] bg-[#FDF6ED]/90 backdrop-blur-md'>
      <div className='mx-auto flex w-full max-w-[1240px] items-center justify-between gap-6 px-5 py-3.5 sm:px-6 lg:px-8'>
        <Link
          to='/'
          className='inline-flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A33D]'
          aria-label='Clyro home'
        >
          <img src={clyroLogo} alt='' className='h-8 w-auto' />
          <span className='text-[1.35rem] font-bold tracking-[-0.02em] text-[#0B0B0B]'>Clyro</span>
        </Link>

        <nav className='hidden items-center gap-7 lg:flex' aria-label='Primary navigation'>
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className='text-[0.9rem] font-medium text-[#26241F] transition-colors hover:text-[#E8A33D]'
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className='hidden shrink-0 items-center gap-3 md:flex'>
          <Link
            to='/login'
            className='inline-flex h-10 items-center justify-center rounded-lg border border-black/15 bg-white px-5 text-[0.875rem] font-semibold text-[#0B0B0B] transition-colors hover:border-black/40'
          >
            Log in
          </Link>
          <Link
            to='/signup'
            className='inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0B0B0B] px-5 text-[0.875rem] font-semibold text-white transition-transform hover:-translate-y-0.5'
          >
            Get Started Free
            <span aria-hidden='true'>→</span>
          </Link>
        </div>

        <button
          type='button'
          className='inline-flex size-10 items-center justify-center rounded-lg border border-black/12 text-[#0B0B0B] md:hidden'
          aria-label='Toggle navigation menu'
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className='border-t border-black/[0.06] bg-[#FDF6ED] md:hidden'>
          <nav className='mx-auto flex w-full max-w-[1240px] flex-col gap-1 px-5 py-4'>
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className='rounded-md px-2 py-2.5 text-sm font-medium text-[#26241F] hover:bg-black/[0.04]'
              >
                {item.label}
              </a>
            ))}
            <div className='mt-3 grid gap-2 border-t border-black/[0.06] pt-4'>
              <Link
                to='/login'
                className='inline-flex h-10 items-center justify-center rounded-lg border border-black/15 bg-white text-sm font-semibold text-[#0B0B0B]'
              >
                Log in
              </Link>
              <Link
                to='/signup'
                className='inline-flex h-10 items-center justify-center rounded-lg bg-[#0B0B0B] text-sm font-semibold text-white'
              >
                Get Started Free →
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
