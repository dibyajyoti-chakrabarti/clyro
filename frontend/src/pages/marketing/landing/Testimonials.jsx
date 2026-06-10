import Card from "../../../components/ui/Card";

export default function Testimonials() {
  return (
    <section className="w-full bg-[#F6F2EA] py-6 text-text-primary lg:py-8">
      <div className="mx-auto grid w-full max-w-[1700px] gap-4 px-4 sm:px-6 lg:grid-cols-[0.32fr_0.68fr] lg:px-10 xl:px-12">
        <Card className="border-black/[0.08] bg-white/70 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-black/90">
            Loved by Builders
          </h2>

          <p className="mt-3 text-4xl font-bold tracking-normal text-amber-500">
            10K+
          </p>

          <p className="mt-2 max-w-[14rem] text-sm leading-6 text-black/60">
            Architectures deployed on AWS via Clyro
          </p>
        </Card>

        <Card className="border-black/[0.08] bg-white/70 p-4 shadow-sm">
          <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p
                className="text-2xl font-semibold leading-none text-amber-500"
                aria-hidden="true"
              >
                "
              </p>

              <blockquote className="mt-2 max-w-2xl text-base leading-8 text-black/85">
                Clyro helped us go from idea to production in a single
                afternoon. The deployment experience is magical.
              </blockquote>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full border border-black/[0.1] bg-black/[0.04] text-sm font-semibold text-black/80">
                  AA
                </div>

                <div>
                  <p className="text-sm font-semibold text-black/90">
                    Anish Agrawal
                  </p>

                  <p className="text-sm text-black/55">Founder, IndieShop</p>
                </div>
              </div>
            </div>

            <p
              className="text-sm font-semibold tracking-[0.2em] text-amber-500"
              aria-label="5 star rating"
            >
              ★★★★★
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
