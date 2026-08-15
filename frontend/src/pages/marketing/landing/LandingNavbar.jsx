import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, ChevronDown } from 'lucide-react'
import clyroLogo from '../../../assets/logos/Clyro_logo.png'

/* Landing-only navbar. Deliberately a copy of components/layout/Navbar rather than a
   change to it — that one is still rendered for /pricing, /login and /signup. */

const navItems = [
  { label: 'Product', href: '#features', hasChevron: true },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Resources', href: '#resources', hasChevron: true },
  { label: 'Docs', href: '#' },
  { label: 'About', href: '#company' },
]

export default function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className='sticky top-4 z-50 w-full px-4 lg:px-8'>
      <div className='mx-auto flex w-full max-w-[1240px] items-center justify-between gap-6 rounded-2xl border border-white/10 bg-marketing-near-black/70 px-5 py-3.5 shadow-lg shadow-black/20 backdrop-blur-xl sm:px-6 lg:px-8'>
        <Link
          to='/'
          className='inline-flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-amber'
          aria-label='Clyro home'
        >
          <img src={clyroLogo} alt='' className='h-8 w-auto' />
          <span className='text-[1rem] font-bold tracking-[-0.02em] text-marketing-text-primary'>Clyro</span>
        </Link>

        <nav className='hidden items-center gap-7 lg:flex' aria-label='Primary navigation'>
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className='inline-flex items-center gap-1 text-[0.85rem] font-medium text-marketing-text-secondary transition-colors hover:text-marketing-amber-core'
            >
              {item.label}
              {item.hasChevron ? <ChevronDown size={14} strokeWidth={2} aria-hidden='true' /> : null}
            </a>
          ))}
        </nav>

        <div className='hidden shrink-0 items-center gap-3 md:flex'>
          <Link
            to='/login'
            className='inline-flex h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 text-[0.85rem] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/15'
          >
            Log in
          </Link>
          <Link
            to='/signup'
            className='inline-flex h-10 items-center gap-1.5 rounded-lg border-2 border-black bg-marketing-amber-2 px-5 text-[0.85rem] font-semibold text-black transition-colors hover:border-marketing-amber-2 hover:bg-black hover:text-marketing-amber-2'
          >
            Get Started Free
            <span aria-hidden='true'>→</span>
          </Link>
        </div>

        <button
          type='button'
          className='inline-flex size-10 items-center justify-center rounded-lg border border-white/15 text-white md:hidden'
          aria-label='Toggle navigation menu'
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className='mx-auto mt-2 w-full max-w-[1240px] rounded-2xl border border-white/10 bg-marketing-near-black/80 shadow-lg shadow-black/20 backdrop-blur-xl md:hidden'>
          <nav className='flex w-full flex-col gap-1 px-5 py-4'>
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className='rounded-md px-2 py-2.5 text-[0.85rem] font-medium text-marketing-text-secondary hover:bg-white/[0.06] hover:text-marketing-amber-core'
              >
                {item.label}
              </a>
            ))}
            <div className='mt-3 grid gap-2 border-t border-white/10 pt-4'>
              <Link
                to='/login'
                className='inline-flex h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-[0.85rem] font-semibold text-white'
              >
                Log in
              </Link>
              <Link
                to='/signup'
                className='inline-flex h-10 items-center justify-center rounded-lg border-2 border-black bg-marketing-amber-2 text-[0.85rem] font-semibold text-black transition-colors hover:border-marketing-amber-2 hover:bg-black hover:text-marketing-amber-2'
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
