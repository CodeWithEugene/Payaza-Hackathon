"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = "Copy Code", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  }

  return (
    <Button type="button" variant="ghost" size="xs" onClick={onCopy} className={className} aria-label={label}>
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

interface CodeBlockProps {
  code: string;
  /** Short caption shown in the header bar, e.g. "JSON" or "Response 200". */
  caption?: string;
  className?: string;
}

/** Monospace block on semantic tokens; horizontal scroll, never page overflow. */
export function CodeBlock({ code, caption, className }: CodeBlockProps) {
  return (
    <div className={cn("bg-muted/60 border-border min-w-0 overflow-hidden rounded-lg border", className)}>
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-1">
        <span className="text-muted-foreground font-mono text-xs">{caption ?? "Code"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="text-foreground overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
