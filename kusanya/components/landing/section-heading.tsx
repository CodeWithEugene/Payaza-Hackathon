import { cn } from "@/lib/utils"

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-sm font-semibold tracking-tight text-primary",
        className
      )}
    >
      {children}
    </p>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  align = "start",
}: {
  id?: string
  eyebrow: string
  title: string
  intro?: string
  align?: "start" | "center"
}) {
  return (
    <div
      className={cn(
        "flex max-w-3xl flex-col gap-3",
        align === "center" && "mx-auto items-center text-center"
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
      >
        {title}
      </h2>
      {intro ? (
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          {intro}
        </p>
      ) : null}
    </div>
  )
}
