const navLinks = [
  'Product',
  'Features',
  'Pricing',
  'Docs',
  'Changelog',
  'About',
  'Contact',
]

const socialLinks = [
  { label: 'Github', icon: 'GH' },
  { label: 'Twitter', icon: 'X' },
  { label: 'Linkedin', icon: 'IN' },
  { label: 'MessageCircle', icon: 'MC' },
]

function linkHref(label) {
  return `/${label.toLowerCase()}`
}

export default function Footer() {
  return (
    <footer className='border-t border-white/[0.08] bg-background text-text-muted'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8'>
        <a
          href='/'
          className='inline-flex items-center gap-2 text-sm font-semibold text-text-primary transition-colors hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          aria-label='Clyro home'
        >
          <span className='flex size-7 items-center justify-center rounded-md border border-amber-300/30 bg-amber-400/10 text-amber-300'>
            <span className='size-2.5 rounded-[2px] border-2 border-current' aria-hidden='true' />
          </span>
          Clyro
        </a>

        <nav aria-label='Footer navigation'>
          <ul className='flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium'>
            {navLinks.map((link) => (
              <li key={link}>
                <a
                  href={linkHref(link)}
                  className='transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <ul className='flex items-center gap-3' aria-label='Social links'>
          {socialLinks.map((social) => (
            <li key={social.label}>
              <a
                href='/'
                aria-label={social.label}
                className='flex size-7 items-center justify-center rounded-md text-[10px] font-semibold text-text-muted transition-colors hover:bg-white/[0.04] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                {social.icon}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
