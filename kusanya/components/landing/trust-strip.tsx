import { TRUST_WORDMARKS } from "./data"

/**
 * Partner and rail wordmarks, set as styled text (no logo artwork). Muted
 * and uniform like a logo strip, but real text so it scales and reads.
 */
export function TrustStrip() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-border/70"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 py-10 md:px-8">
        <h2
          id="trust-heading"
          className="text-center text-sm font-medium text-muted-foreground"
        >
          Built On Payaza, Powered By TypeSafe Jev, Paid The Way Your Buyers
          Already Pay
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
          {TRUST_WORDMARKS.map((mark) => (
            <li
              key={mark.name}
              className={`text-xl text-foreground/70 sm:text-2xl ${mark.className}`}
            >
              {mark.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
