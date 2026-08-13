import clyroLogo from '../../../assets/logos/Clyro_logo.png'
import githubLogo from '../../../assets/logos/github-fill.svg'
import linkedinLogo from '../../../assets/logos/linkedin-box-fill.svg'
import twitterLogo from '../../../assets/logos/twitter-fill.svg'
import discordLogo from '../../../assets/logos/discord-fill.svg'

/* Landing-only footer. components/layout/Footer stays untouched for /pricing and the
   auth pages that share PublicLayout. */

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Solutions', href: '#solutions' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Changelog', href: '#changelog' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Documentation', href: '#docs' },
      { label: 'Blog', href: '#blog' },
      { label: 'Guides', href: '#guides' },
      { label: 'Help Center', href: '#help' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '#about' },
      { label: 'Careers', href: '#careers' },
      { label: 'Contact', href: '#contact' },
      { label: 'Privacy Policy', href: '#privacy' },
    ],
  },
]

/* No YouTube glyph ships with the pinned lucide-react, and there is no asset for it,
   so it is drawn inline. */
function YoutubeMark() {
  return (
    <svg viewBox='0 0 24 24' className='size-[19px]' fill='currentColor' aria-hidden='true'>
      <path d='M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42A2.51 2.51 0 0 0 2.42 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81M10 15.02v-6l5.2 3z' />
    </svg>
  )
}

const socials = [
  { label: 'GitHub', logo: githubLogo },
  { label: 'LinkedIn', logo: linkedinLogo },
  { label: 'Twitter', logo: twitterLogo },
  { label: 'YouTube', Icon: YoutubeMark },
  { label: 'Discord', logo: discordLogo },
]

export default function LandingFooter() {
  return (
    <footer className='bg-[#FDF6ED] px-5 pb-8 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-[1240px] rounded-2xl bg-[#0F1F1B] px-6 py-12 sm:px-10 lg:px-12'>
        <div className='grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,0.75fr))_minmax(0,1.2fr)]'>
          <div>
            <div className='inline-flex items-center gap-2.5'>
              <img src={clyroLogo} alt='' className='h-8 w-auto' />
              <span className='text-[1.25rem] font-bold text-white'>Clyro</span>
            </div>
            <p className='mt-5 text-[0.75rem] text-white/45'>
              © 2025 Clyro. All rights reserved.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h3 className='text-[0.85rem] font-semibold text-white'>{column.heading}</h3>
              <ul className='mt-4 space-y-2.5'>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className='text-[0.78rem] text-white/50 transition-colors hover:text-white'
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className='text-[0.85rem] font-semibold text-white'>Stay Updated</h3>
            <p className='mt-4 max-w-[18rem] text-[0.78rem] leading-[1.6] text-white/50'>
              Get the latest updates and insights on cloud architecture.
            </p>

            <form
              className='mt-4 flex items-center gap-2'
              onSubmit={(event) => event.preventDefault()}
            >
              <label htmlFor='landing-newsletter-email' className='sr-only'>
                Email address
              </label>
              <input
                id='landing-newsletter-email'
                type='email'
                placeholder='Enter your email'
                className='h-10 w-full min-w-0 rounded-lg border border-white/12 bg-white/[0.06] px-3.5 text-[0.8rem] text-white placeholder:text-white/35 focus:border-[#E8A33D]/60 focus:outline-none'
              />
              <button
                type='submit'
                aria-label='Subscribe'
                className='inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#E8A33D] text-[#0B0B0B] transition-transform hover:-translate-y-0.5'
              >
                <span aria-hidden='true'>→</span>
              </button>
            </form>
          </div>
        </div>

        <ul className='mt-10 flex items-center gap-4 border-t border-white/[0.08] pt-7' aria-label='Social links'>
          {socials.map((social) => (
            <li key={social.label}>
              <a
                href='/'
                aria-label={social.label}
                className='flex size-8 items-center justify-center rounded-md text-white/55 transition-colors hover:text-white'
              >
                {social.Icon ? (
                  <social.Icon />
                ) : (
                  <img
                    src={social.logo}
                    alt=''
                    aria-hidden='true'
                    className='h-[19px] w-[19px] opacity-70 invert transition-opacity hover:opacity-100'
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
