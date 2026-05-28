const brands = ['AWS', 'GitHub', 'Terraform', 'CloudFront']

export default function TrustedBy() {
  return (
    <section className='border-y border-white/[0.08] bg-background text-text-primary'>
      <div className='mx-auto w-full max-w-7xl px-5 py-8 text-center sm:px-6 lg:px-8'>
        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-text-muted'>
          TRUSTED BY DEVELOPERS & TEAMS
        </p>

        <ul className='mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14'>
          {brands.map((brand) => (
            <li
              key={brand}
              className='text-lg font-semibold tracking-normal text-text-primary/80 sm:text-xl'
            >
              {brand}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
