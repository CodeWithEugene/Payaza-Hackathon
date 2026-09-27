import { cn } from "@/lib/utils";

/**
 * KusanyaMark — the "k." monogram as a lucide-style vector mark (24 grid,
 * stroke 2, round caps). The two arms of the k converge into the stem —
 * *kusanya*, to gather: collections flowing in — and the period sits on the
 * baseline as the gathered coin.
 *
 * Strokes are `currentColor`, so the mark inherits the semantic foreground
 * token and is correct in light mode, dark mode, muted contexts (buyer
 * wordmark) and on any surface — no per-theme variants needed in-app.
 * Fixed-ink standalone files for decks/forms: public/logo/*.svg (+ PNGs).
 */
export function KusanyaMark({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* stem — the invoice edge everything lands against */}
        <path d="M6.5 4V19" />
        {/* arms — streams converging into the stem */}
        <path d="M6.5 13L13.5 6" />
        <path d="M6.5 13L12.75 19" />
      </g>
      {/* the "." of "k." — the gathered coin, resting on the baseline */}
      <circle cx="17.75" cy="17.1" r="1.9" fill="currentColor" />
    </svg>
  );
}
