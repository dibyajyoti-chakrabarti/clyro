import githubLogo from '../../../assets/logos/github-fill.svg'
import linkedinLogo from '../../../assets/logos/linkedin-box-fill.svg'
import twitterLogo from '../../../assets/logos/twitter-fill.svg'

/* Landing-only footer. components/layout/Footer stays untouched for /pricing and the
   auth pages that share PublicLayout. */

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'How It Works', href: '#how-it-works' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Documentation', href: '#docs' },
      { label: 'Blog', href: '#blog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '#about' },
      { label: 'Contact', href: '#contact' },
      { label: 'Privacy Policy', href: '#privacy' },
      { label: 'Terms of Service', href: '#terms' },
    ],
  },
]

const socials = [
  { label: 'Twitter', logo: twitterLogo },
  { label: 'LinkedIn', logo: linkedinLogo },
  { label: 'GitHub', logo: githubLogo },
]

export default function LandingFooter() {
  return (
    <footer className='bg-marketing-bg-deep px-5 py-12 sm:px-6 lg:px-8 lg:py-16'>
      <div className='mx-auto w-full max-w-[1240px]'>
        <div className='grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))]'>
          <div>
            <div className='inline-flex items-center gap-2.5'>
              <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-marketing-amber-core' aria-hidden='true' />
              <span className='text-[1.25rem] font-bold text-marketing-text-primary'>Clyro</span>
            </div>
            <p className='mt-5 max-w-[19rem] text-[0.85rem] leading-[1.6] text-marketing-text-secondary'>
              AI-powered cloud infrastructure platform that helps engineers build,
              deploy, and optimize on AWS.
            </p>
            <span className='mt-5 inline-flex items-center gap-2 rounded-full border border-marketing-amber-core/40 px-3 py-1.5'>
              <span className='size-1.5 rounded-full bg-marketing-amber-core' aria-hidden='true' />
              <span className='text-[0.7rem] font-bold uppercase tracking-wide text-marketing-amber-core'>
                All Systems Operational
              </span>
            </span>
          </div>

          {columns.map((column, index) => (
            <div
              key={column.heading}
              className={`lg:pl-8 ${index === 0 ? 'lg:border-l lg:border-marketing-border-hairline' : ''}`}
            >
              <h3 className='text-[1rem] font-semibold text-marketing-text-primary'>{column.heading}</h3>
              <ul className='mt-4 space-y-2.5'>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className='text-[0.85rem] text-marketing-text-muted-2 transition-colors hover:text-marketing-gold-light'
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className='mt-10 flex flex-col items-center gap-6 border-t border-marketing-border-hairline pt-7 sm:flex-row sm:justify-between'>
          <p className='text-[0.75rem] text-marketing-text-muted-2/70'>© 2026 Clyro. All rights reserved.</p>

          <ul className='flex items-center gap-3' aria-label='Social links'>
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href='/'
                  aria-label={social.label}
                  className='flex size-8 items-center justify-center rounded-full border border-marketing-border-hairline text-marketing-text-muted-2 transition-colors hover:border-marketing-gold-light hover:text-marketing-gold-light'
                >
                  <img
                    src={social.logo}
                    alt=''
                    aria-hidden='true'
                    className='h-[15px] w-[15px] opacity-70 invert transition-opacity hover:opacity-100'
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
