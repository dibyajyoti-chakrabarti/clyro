import awsLogo from '../../../assets/logos/AWS_Logo.svg'
import githubLogo from '../../../assets/logos/github-fill.svg'
import terraformLogo from '../../../assets/logos/terraform_logo.svg'
import cloudfrontLogo from '../../../assets/logos/cloudfront_logo.svg'

const brands = [
  {
    name: '',
    logo: awsLogo,
  },
  {
    name: 'GitHub',
    logo: githubLogo,
  },
  {
    name: 'Terraform',
    logo: terraformLogo,
  },
  {
    name: 'CloudFront',
    logo: cloudfrontLogo,
  },
]

export default function TrustedBy() {
  return (
    <section className='w-full border-y border-white/[0.06] bg-background text-text-primary'>
      <div className='mx-auto w-full max-w-[1700px] px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-12 xl:px-12'>
        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-text-muted'>
          BUILT WITH
        </p>

        <ul className='mt-6 grid grid-cols-2 items-center justify-center gap-8 sm:flex lg:gap-12'>
          {brands.map((brand, index) => (
            <li key={brand.name} className='contents sm:flex sm:items-center sm:gap-8 lg:gap-12'>
              <div className='flex items-center justify-center gap-3'>
                <img
                  src={brand.logo}
                  alt={`${brand.name} logo`}
                  className='h-8 w-auto object-contain opacity-60'
                />
                <span className='text-xl font-medium text-text-muted'>{brand.name}</span>
              </div>
              {index < brands.length - 1 ? (
                <div className='hidden h-10 w-px bg-white/[0.1] lg:block' />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
