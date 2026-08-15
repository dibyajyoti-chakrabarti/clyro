import { MapPin, Activity } from 'lucide-react'
import awsLogo from '../../../assets/logos/AWS_Logo.svg'

/* Microsoft, Airbnb, Docker, and Datadog have no muted/monochrome asset in the repo,
   so they ship as inline SVG / icon marks tinted with currentColor. */
function MicrosoftMark() {
  return (
    <svg viewBox='0 0 24 24' className='h-5 w-5' aria-hidden='true' fill='currentColor'>
      <rect x='1' y='1' width='10' height='10' />
      <rect x='13' y='1' width='10' height='10' />
      <rect x='1' y='13' width='10' height='10' />
      <rect x='13' y='13' width='10' height='10' />
    </svg>
  )
}

function DockerMark() {
  return (
    <svg viewBox='0 0 24 24' className='h-6 w-6' aria-hidden='true' fill='currentColor'>
      {/* Container stack */}
      <rect x='2.4' y='10.2' width='3.3' height='3.3' rx='0.4' />
      <rect x='6.2' y='10.2' width='3.3' height='3.3' rx='0.4' />
      <rect x='10' y='10.2' width='3.3' height='3.3' rx='0.4' />
      <rect x='13.8' y='10.2' width='3.3' height='3.3' rx='0.4' />
      <rect x='6.2' y='6.4' width='3.3' height='3.3' rx='0.4' />
      <rect x='10' y='6.4' width='3.3' height='3.3' rx='0.4' />
      <rect x='10' y='2.6' width='3.3' height='3.3' rx='0.4' />
      {/* Hull + funnel */}
      <path d='M1.2 14.4h21.4c-.3 1.1-1.3 1.9-2.7 2.1-.9 1.5-2.6 2.7-5.1 3-1 .1-2 .2-3 .2-3.4 0-6.2-.9-7.9-2.6a7.6 7.6 0 0 1-2.7-2.7z' />
      <path d='M18.1 9.4c.9-.6 1.6-.6 2.5 0-.1 1-.6 1.7-1.3 2-.7-.3-1.1-1-1.2-2z' />
    </svg>
  )
}

const tools = [
  { name: 'Amazon', logo: awsLogo, imgClassName: 'h-6' },
  { name: 'Microsoft', Mark: MicrosoftMark },
  { name: 'Airbnb', Icon: MapPin },
  { name: 'Docker', Mark: DockerMark },
  { name: 'Datadog', Icon: Activity },
]

export default function ToolsStrip() {
  return (
    <section className='bg-marketing-dark px-5 pb-16 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-[1240px]'>
        <p className='text-center text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-marketing-muted'>
          Trusted by engineers at
        </p>

        <ul className='mt-8 grid grid-cols-2 items-center justify-items-center gap-x-8 gap-y-6 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-14 lg:gap-y-6'>
          {tools.map((tool) => (
            <li key={tool.name} className='flex items-center gap-2 text-marketing-muted/80'>
              {tool.Mark ? (
                <tool.Mark />
              ) : tool.Icon ? (
                <tool.Icon size={18} strokeWidth={1.75} />
              ) : (
                <img
                  src={tool.logo}
                  alt={`${tool.name} logo`}
                  className={`${tool.imgClassName} w-auto opacity-80 brightness-0 invert`}
                />
              )}
              <span className='text-[0.9rem] font-medium tracking-wide'>{tool.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
