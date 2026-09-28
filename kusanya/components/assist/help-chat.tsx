"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, MessageCircleQuestion, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  audienceForPath,
  getArticle,
  HELP_MESSAGE_MAX,
  HELP_STARTERS,
  type HelpAudience,
} from "@/lib/help/knowledge";
import { cn } from "@/lib/utils";

/**
 * Kusanya Help: a curated-answer assistant. The server (POST /api/help) only
 * returns article ids picked by Jev; every answer shown here is vetted copy
 * from lib/help/knowledge.ts, so the assistant never invents fees or promises.
 */

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; kind: "welcome" | "unsure" | "error"; text: string; suggestions: string[] }
  | { id: number; role: "assistant"; kind: "answer"; articleId: string; suggestions: string[]; source: "jev" | "rules" | "picked" };

/** Omit that keeps the union's variants apart. */
type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, "id"> : never) : never;

interface HelpRouting {
  answerId: string | null;
  suggestionIds: string[];
  source: "jev" | "rules";
}

const WELCOME =
  "Hi, I'm Kusanya Help. Ask me about invoices, payments, payouts or the demo, or pick a common question below.";
const UNSURE = "I'm not sure I have an answer for that. Did you mean one of these?";

export function HelpChat() {
  const audience = audienceForPath(usePathname() ?? "/");
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage(audience)]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const nextId = useRef(1);

  function push(...items: NewMessage[]) {
    setMessages((current) => [...current, ...items.map((m) => ({ ...m, id: nextId.current++ }) as Message)]);
  }

  function pickArticle(articleId: string) {
    const article = getArticle(articleId);
    if (!article) return;
    push({ role: "user", text: article.title }, { role: "assistant", kind: "answer", articleId, suggestions: [], source: "picked" });
  }

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    push({ role: "user", text });
    setBusy(true);
    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, audience }),
      });
      const body = (await res.json().catch(() => null)) as (HelpRouting & { error?: string }) | null;
      if (!res.ok || !body) {
        push({ role: "assistant", kind: "error", text: body?.error ?? "Something went wrong. Please try again.", suggestions: [] });
        return;
      }
      const known = body.suggestionIds.filter((id) => getArticle(id));
      if (body.answerId && getArticle(body.answerId)) {
        push({ role: "assistant", kind: "answer", articleId: body.answerId, suggestions: known.slice(0, 2), source: body.source });
      } else {
        const fallback = known.length > 0 ? known : [...HELP_STARTERS[audience]];
        push({ role: "assistant", kind: "unsure", text: UNSURE, suggestions: [...new Set([...fallback, "contact_human"])] });
      }
    } catch {
      push({ role: "assistant", kind: "error", text: "You seem to be offline. Please check your connection.", suggestions: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon-lg" className="size-12 rounded-full shadow-lg" aria-label="Open Kusanya Help chat">
              <MessageCircleQuestion className="size-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Help</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className="flex h-[min(34rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col gap-0 p-0"
        aria-label="Kusanya Help chat"
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full">
            <Sparkles className="size-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-heading text-sm font-semibold">Kusanya Help</h2>
            <p className="text-muted-foreground text-xs">Curated answers, picked by Jev AI</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close help chat" onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>

        <MessageList messages={messages} busy={busy} onPick={pickArticle} />

        <form onSubmit={ask} className="border-t p-3">
          <InputGroup>
            <InputGroupInput
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Your question"
              maxLength={HELP_MESSAGE_MAX}
              disabled={busy}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-xs"
                aria-label="Send question"
                disabled={busy || draft.trim().length === 0}
              >
                <ArrowUp />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function MessageList({ messages, busy, onPick }: { messages: Message[]; busy: boolean; onPick: (id: string) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((m) =>
        m.role === "user" ? (
          <p key={m.id} className="bg-primary text-primary-foreground max-w-[85%] self-end rounded-2xl rounded-br-sm px-3 py-2 text-sm">
            {m.text}
          </p>
        ) : (
          <AssistantMessage key={m.id} message={m} onPick={onPick} />
        ),
      )}
      {busy && (
        <p className="bg-muted text-muted-foreground flex items-center gap-2 self-start rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
          <Spinner /> Looking that up
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}

function AssistantMessage({
  message,
  onPick,
}: {
  message: Extract<Message, { role: "assistant" }>;
  onPick: (id: string) => void;
}) {
  const article = message.kind === "answer" ? getArticle(message.articleId) : undefined;
  return (
    <div className="flex max-w-[92%] flex-col gap-2 self-start">
      <div
        className={cn(
          "bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm",
          message.kind === "error" && "bg-destructive/10 text-destructive",
        )}
      >
        {article ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{article.title}</p>
            <p>{article.answer}</p>
            {article.link && (
              <Button asChild variant="outline" size="sm" className="self-start">
                <Link href={article.link.href}>{article.link.label}</Link>
              </Button>
            )}
            {message.kind === "answer" && message.source !== "picked" && (
              <p className="text-muted-foreground text-xs">
                {message.source === "jev" ? "Matched by Jev AI" : "Matched by keywords"}
              </p>
            )}
          </div>
        ) : (
          <p>{"text" in message ? message.text : ""}</p>
        )}
      </div>
      {message.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.suggestions.map((id) => {
            const a = getArticle(id);
            return a ? (
              <Button key={id} variant="outline" size="xs" className="h-auto rounded-full py-1 whitespace-normal" onClick={() => onPick(id)}>
                {a.title}
              </Button>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function welcomeMessage(audience: HelpAudience): Message {
  return { id: 0, role: "assistant", kind: "welcome", text: WELCOME, suggestions: [...HELP_STARTERS[audience]] };
}
