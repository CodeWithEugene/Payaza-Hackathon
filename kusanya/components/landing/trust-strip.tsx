import Image from "next/image"

import { TRUST_LOGOS } from "./data"

/**
 * Partner and rail logos: the official artwork, unmodified, with no frame.
 * In dark mode each sits on a light tile because several marks are dark ink
 * that would vanish on the dark background, and brand rules forbid recoloring.
 */
export function TrustStrip() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-border/70"
    >
      <div className="mx-auto flex w-full max-w-[110rem] flex-col items-center gap-6 px-4 py-10 md:px-8 lg:px-12 2xl:px-16">
        <h2
          id="trust-heading"
          className="text-center text-sm font-medium text-muted-foreground"
        >
          Built On Payaza, Powered By TypeSafe Jev, Paid The Way Your Buyers
          Already Pay
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {TRUST_LOGOS.map((logo) => (
            <li
              key={logo.name}
              className="flex h-16 items-center justify-center rounded-2xl px-5 sm:h-[4.5rem] sm:px-6 dark:bg-white"
            >
              <Image
                src={logo.src}
                alt={logo.name}
                width={logo.width}
                height={logo.height}
                unoptimized
                className={`w-auto ${logo.heightClass}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
