"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copy the public buyer payment link (/i/{token}) to the clipboard. */
export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/i/${token}`);
      setCopied(true);
      toast.success("Buyer link copied to your clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Your browser blocked clipboard access — copy the link from the address bar instead.");
    }
  }

  return (
    <Button variant="outline" onClick={copy}>
      {copied ? <Check data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
      {copied ? "Copied" : "Copy buyer link"}
    </Button>
  );
}
