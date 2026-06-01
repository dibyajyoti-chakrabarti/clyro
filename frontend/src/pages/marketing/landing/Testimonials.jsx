import Card from '../../../components/ui/Card'

export default function Testimonials() {
  return (
    <section className='w-full bg-[#F6F2EA] pt-12 text-text-primary lg:pt-16'>
      <div className='mx-auto grid w-full max-w-[1700px] gap-3 px-4 sm:px-6 lg:grid-cols-[0.32fr_0.68fr] lg:px-10 xl:px-12'>
        <Card className='border-black/[0.08] bg-white/70 p-3 shadow-sm'>
          <h2 className='text-sm font-semibold text-black/90'>Loved by Builders</h2>
          <p className='mt-2 text-2xl font-bold tracking-normal text-amber-600'>10K+</p>
          <p className='mt-1 max-w-[11rem] text-xs leading-4 text-black/70'>
            Architectures deployed on AWS via Clyro
          </p>
        </Card>

        <Card className='border-black/[0.08] bg-white/70 p-3 shadow-sm sm:p-4'>
          <div className='flex h-full flex-col justify-between gap-3 sm:flex-row sm:items-end'>
            <div>
              <p className='text-2xl font-semibold leading-none text-amber-600' aria-hidden='true'>
                "
              </p>
              <blockquote className='mt-1 max-w-xl text-xs leading-5 text-black/80 sm:text-sm'>
                Clyro helped us go from idea to production in a single afternoon. The deployment experience is magical.
              </blockquote>
              <div className='mt-3 flex items-center gap-2.5'>
                <div className='flex size-8 items-center justify-center rounded-full border border-black/[0.08] bg-white/70 text-[11px] font-semibold text-black/90'>
                  AA
                </div>
                <div>
                  <p className='text-xs font-semibold text-black/90'>Anish Agrawal</p>
                  <p className='text-[11px] text-black/70'>Founder, IndieShop</p>
                </div>
              </div>
            </div>

            <p className='text-sm font-semibold tracking-[0.12em] text-amber-600' aria-label='5 star rating'>
              *****
            </p>
          </div>
        </Card>
      </div>
    </section>
  )
}
