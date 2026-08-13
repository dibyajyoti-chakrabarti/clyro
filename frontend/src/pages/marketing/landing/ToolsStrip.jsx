import awsLogo from '../../../assets/logos/AWS_Logo.svg'
import terraformLogo from '../../../assets/logos/terraform_logo.svg'
import githubLogo from '../../../assets/logos/github_black.svg'
import reactLogo from '../../../assets/logos/react-svgrepo-com.svg'

/* Docker and Python have no asset in the repo, so they ship as inline SVG marks. */
function DockerMark() {
  return (
    <svg viewBox='0 0 24 24' className='h-7 w-7' aria-hidden='true' fill='#2496ED'>
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

function PythonMark() {
  return (
    <svg viewBox='0 0 24 24' className='h-7 w-7' aria-hidden='true'>
      <path
        fill='#3776AB'
        d='M11.9 0c-1 0-1.94.09-2.77.24C6.7.68 6.26 1.6 6.26 3.3v2.24h5.76v.73H4.1c-1.71 0-3.2 1.03-3.67 2.98a11 11 0 0 0 0 5.98c.42 1.79 1.54 3.06 3.25 3.06h1.98v-2.68c0-1.94 1.68-3.65 3.67-3.65h5.75c1.63 0 2.94-1.35 2.94-3V3.3c0-1.6-1.35-2.8-2.94-3.07A18 18 0 0 0 11.9 0M8.79 1.76c.6 0 1.1.5 1.1 1.12s-.5 1.11-1.1 1.11a1.1 1.1 0 0 1-1.1-1.11c0-.62.49-1.12 1.1-1.12'
      />
      <path
        fill='#FFD43B'
        d='M18.24 6.27v2.6c0 2.03-1.72 3.73-3.67 3.73H8.82c-1.6 0-2.94 1.38-2.94 3v5.61c0 1.6 1.39 2.54 2.94 3 1.86.54 3.64.64 5.87 0 1.48-.43 2.94-1.3 2.94-3v-2.24h-5.75v-.73h8.62c1.67 0 2.3-1.17 2.88-2.92.6-1.8.58-3.53 0-5.84-.42-1.75-1.2-2.92-2.88-2.92zm-3.23 13.86c.61 0 1.1.5 1.1 1.11 0 .62-.49 1.12-1.1 1.12a1.11 1.11 0 0 1-1.1-1.12c0-.61.49-1.11 1.1-1.11'
      />
    </svg>
  )
}

const tools = [
  { name: 'AWS', logo: awsLogo, showLabel: false, className: 'h-9' },
  { name: 'Terraform', logo: terraformLogo, showLabel: true, className: 'h-7' },
  { name: 'Docker', Mark: DockerMark, showLabel: true },
  { name: 'GitHub', logo: githubLogo, showLabel: true, className: 'h-6' },
  { name: 'Python', Mark: PythonMark, showLabel: true },
  { name: 'React', logo: reactLogo, showLabel: true, className: 'h-7' },
]

export default function ToolsStrip() {
  return (
    <section className='bg-[#FDF6ED] px-5 pb-16 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-[1240px] rounded-2xl border border-black/[0.06] bg-[#FBF3E6] px-6 py-9 sm:px-10'>
        <p className='text-center text-[0.85rem] font-medium text-[#5B574E]'>
          Works seamlessly with the tools you use every day
        </p>

        <ul className='mt-7 grid grid-cols-2 items-center justify-items-center gap-y-7 sm:grid-cols-3 lg:flex lg:justify-between lg:gap-8'>
          {tools.map((tool) => (
            <li key={tool.name} className='flex items-center gap-2.5 opacity-90'>
              {tool.Mark ? (
                <tool.Mark />
              ) : (
                <img src={tool.logo} alt={`${tool.name} logo`} className={`${tool.className} w-auto`} />
              )}
              {tool.showLabel ? (
                <span className='text-[1.05rem] font-semibold text-[#26241F]'>{tool.name}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
