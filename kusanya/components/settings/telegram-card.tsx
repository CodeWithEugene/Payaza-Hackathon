"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ExternalLink, MessageCircle, Send, Unlink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { createTelegramLinkAction, removeTelegramLinkAction } from "@/lib/actions/telegram";

export interface TelegramChatRow {
  id: string;
  username: string | null;
  firstName: string | null;
  linkedAt: string;
}

/**
 * Settings → Telegram. "Connect Telegram" mints a one-time deep link
 * (t.me/<bot>?start=<code>, 15 minutes). Desktop users get a QR code to
 * scan with the phone; phone users tap straight through.
 */
export function TelegramCard({
  botUsername,
  configured,
  chats,
}: {
  botUsername: string;
  configured: boolean;
  chats: TelegramChatRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [link, setLink] = React.useState<{ url: string; qr: string } | null>(null);

  async function connect() {
    setBusy(true);
    try {
      const res = await createTelegramLinkAction();
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not create a connect link.");
        return;
      }
      const qr = await QRCode.toDataURL(res.data.url, { margin: 1, width: 220 });
      setLink({ url: res.data.url, qr });
      window.open(res.data.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await removeTelegramLinkAction(id);
    if (res.ok) {
      toast.success("Chat disconnected.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not disconnect that chat.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Telegram
          {chats.length > 0 && <Badge variant="secondary">Connected</Badge>}
        </CardTitle>
        <CardDescription>
          Forward a buyer&apos;s order to <span className="font-mono">@{botUsername}</span> and it comes back as a
          screened invoice with a Payaza payment link, ready to send with one tap.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {chats.length > 0 && (
          <ItemGroup>
            {chats.map((c) => (
              <Item key={c.id} variant="muted">
                <ItemMedia variant="icon">
                  <MessageCircle />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{c.username ? `@${c.username}` : (c.firstName ?? "Telegram Chat")}</ItemTitle>
                  <ItemDescription>Connected {new Date(c.linkedAt).toLocaleDateString()}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                    <Unlink data-icon="inline-start" />
                    Disconnect
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}

        {configured ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={connect} disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
              {chats.length > 0 ? "Connect Another Chat" : "Connect Telegram"}
            </Button>
            <Button variant="outline" asChild>
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink data-icon="inline-start" />
                Open Bot
              </a>
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">The Telegram bot isn&apos;t configured on this deployment yet.</p>
        )}

        {link && (
          <div className="flex flex-col items-start gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize */}
            <img src={link.qr} alt="QR code that opens the Kusanya Telegram bot" width={140} height={140} className="rounded-md bg-white p-1" />
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">Scan with your phone, or tap Start in the Telegram window that opened.</p>
              <p className="text-muted-foreground">This link works once and expires in 15 minutes.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
