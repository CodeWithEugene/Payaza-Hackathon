import { Info } from "lucide-react";
import { Amount } from "@/components/money/amount";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { InvoiceWaterfall } from "@/lib/services/waterfall";

/**
 * Transparency waterfall — "where your money goes" (the trust feature).
 * Honest states: while estimated, an explicit note says actuals replace the
 * figures automatically once Payaza confirms the collection.
 */
export function WaterfallPanel({ waterfall }: { waterfall: InvoiceWaterfall }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where your money goes</CardTitle>
        <CardDescription>
          Every fee, split, and conversion — before the money reaches your pocket.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col">
          {waterfall.lines.map((line, i) => {
            const isNet = line.kind === "net";
            const negative = line.minor < 0;
            return (
              <li key={`${line.kind}-${line.label}-${i}`}>
                {isNet && <Separator className="my-2" />}
                <div
                  className={cn(
                    "flex items-start justify-between gap-3 py-1",
                    isNet && "pt-2",
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-sm",
                        isNet && "text-base font-semibold",
                      )}
                    >
                      {line.label}
                    </span>
                    {line.note && (
                      <span className="text-xs text-muted-foreground">{line.note}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-baseline gap-0.5",
                      isNet ? "text-base font-semibold" : "text-sm",
                    )}
                  >
                    {negative && <span aria-hidden="true">−</span>}
                    <Amount minor={Math.abs(line.minor)} currency={line.currency} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <Separator />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Settlement</span>
          <span>{waterfall.settleEtaDays}</span>
        </div>
        {waterfall.estimated && (
          <Alert>
            <Info />
            <AlertDescription>
              Figures are estimates until Payaza confirms the collection — actuals
              replace them automatically.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
