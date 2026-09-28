import { STATS } from "./data"

/**
 * Dark contrast band with the numbers that matter. Uses the fixed brand ink
 * surface in both themes (the bright hero tones all clear 5:1 on it).
 */
export function StatsBand() {
  return (
    <section aria-labelledby="stats-heading" className="px-4 md:px-8 lg:px-12 2xl:px-16">
      <div className="k-ink-glow mx-auto flex w-full max-w-[110rem] flex-col gap-14 overflow-hidden rounded-3xl px-6 py-16 text-brand-ink-foreground ring-1 ring-foreground/10 md:px-12 md:py-20 dark:ring-white/10">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-sm font-semibold text-hero-sun">
            Pricing, In Plain Numbers
          </p>
          <h2
            id="stats-heading"
            className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
          >
            Money Movement You Can Read Line By Line
          </h2>
          <p className="text-lg text-pretty text-brand-ink-muted">
            Every fee and the FX rate are shown before the invoice goes out, so
            the KES you are quoted is the KES you plan around.
          </p>
        </div>
        <dl className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-2 border-l border-white/15 pl-5"
            >
              <dt className="order-2 font-medium text-brand-ink-foreground">
                {stat.label}
              </dt>
              <dd
                className={`order-1 font-heading text-4xl font-semibold tracking-tight tabular-nums lg:text-5xl ${stat.tone}`}
              >
                {stat.value}
              </dd>
              <dd className="order-3 text-sm leading-relaxed text-brand-ink-muted">
                {stat.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
