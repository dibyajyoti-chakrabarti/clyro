import awsLogo from '../../../assets/logos/AWS_Logo.svg'
import githubLogo from '../../../assets/logos/github_logo.svg'
import terraformLogo from '../../../assets/logos/terraform_logo.svg'
import cloudfrontLogo from '../../../assets/logos/cloudfront_logo.svg'

const brands = [
  {
    name: 'AWS',
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
    <section className='w-full border-y border-black/[0.08] bg-[#F6F2EA] text-text-primary'>
      <div className='mx-auto w-full max-w-[1700px] px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-12 xl:px-12'>
        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-black/60'>
          TRUSTED BY DEVELOPERS & TEAMS
        </p>

        <ul className='mt-6 grid grid-cols-2 items-center justify-center gap-8 sm:flex lg:gap-12'>
          {brands.map((brand, index) => (
            <li key={brand.name} className='contents sm:flex sm:items-center sm:gap-8 lg:gap-12'>
              <div className='flex items-center justify-center gap-3'>
                <img
                  src={brand.logo}
                  alt={`${brand.name} logo`}
                  className='h-8 w-auto object-contain opacity-80'
                />
                <span className='text-xl font-medium text-black/85'>{brand.name}</span>
              </div>
              {index < brands.length - 1 ? (
                <div className='hidden h-10 w-px bg-black/[0.12] lg:block' />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
