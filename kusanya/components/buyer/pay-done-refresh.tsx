"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

const REFRESH_EVERY_MS = 4_000;
const MAX_ATTEMPTS = 15; // about a minute, then the buyer is told to wait for the receipt

/**
 * /pay-done pending state: re-run the server-side verification a few times
 * (router.refresh re-renders the RSC page, which re-queries Payaza) so the
 * buyer sees "confirmed" without reloading by hand.
 */
export function PayDoneRefresh() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const exhausted = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (exhausted) return;
    const id = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => window.clearTimeout(id);
  }, [attempts, exhausted, router]);

  return (
    <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm" role="status">
      {exhausted ? (
        "Still waiting on Payaza. Your email receipt will arrive once it confirms."
      ) : (
        <>
          <Spinner /> Checking with Payaza again automatically
        </>
      )}
    </p>
  );
}
