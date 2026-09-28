"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Snippets } from "@/lib/developers/snippets";
import { CopyButton } from "./code-block";

const LANGUAGES = [
  { value: "curl", label: "cURL" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
] as const;

type Language = (typeof LANGUAGES)[number]["value"];

/** cURL / JavaScript fetch / Python requests samples with a copy button. */
export function CodeTabs({ snippets }: { snippets: Snippets }) {
  const [language, setLanguage] = useState<Language>("curl");

  return (
    <Tabs
      value={language}
      onValueChange={(v) => setLanguage(v as Language)}
      className="bg-muted/60 border-border min-w-0 gap-0 overflow-hidden rounded-lg border"
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-2 py-1">
        <TabsList variant="line" aria-label="Code sample language">
          {LANGUAGES.map((l) => (
            <TabsTrigger key={l.value} value={l.value} className="text-xs">
              {l.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <CopyButton text={snippets[language]} />
      </div>
      {LANGUAGES.map((l) => (
        <TabsContent key={l.value} value={l.value}>
          <pre className="text-foreground overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            <code>{snippets[l.value]}</code>
          </pre>
        </TabsContent>
      ))}
    </Tabs>
  );
}
