import Card from "../../../components/ui/Card";

export default function Testimonials() {
  return (
    <section className="w-full bg-background py-6 text-text-primary lg:py-8">
      <div className="mx-auto grid w-full max-w-[1700px] gap-4 px-4 sm:px-6 lg:grid-cols-[0.32fr_0.68fr] lg:px-10 xl:px-12">
        <Card className="border-white/[0.08] bg-surface/40 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">
            Loved by Builders
          </h2>

          <p className="mt-3 text-4xl font-bold tracking-normal text-amber-300">
            10K+
          </p>

          <p className="mt-2 max-w-[14rem] text-sm leading-6 text-text-muted">
            Architectures deployed on AWS via Clyro
          </p>
        </Card>

        <Card className="border-white/[0.08] bg-surface/40 p-4 shadow-sm">
          <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p
                className="text-2xl font-semibold leading-none text-amber-300"
                aria-hidden="true"
              >
                "
              </p>

              <blockquote className="mt-2 max-w-2xl text-base leading-8 text-text-primary">
                Clyro helped us go from idea to production in a single
                afternoon. The deployment experience is magical.
              </blockquote>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-text-primary">
                  AA
                </div>

                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Anish Agrawal
                  </p>

                  <p className="text-sm text-text-muted">Founder, IndieShop</p>
                </div>
              </div>
            </div>

            <p
              className="text-sm font-semibold tracking-[0.2em] text-amber-300"
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
