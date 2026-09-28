"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions/api-keys";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "./code-block";

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string | null;
  revoked: string | null;
}

function RevokeButton({ row }: { row: KeyRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function revoke() {
    startTransition(async () => {
      const res = await revokeApiKeyAction(row.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not revoke the key.");
        return;
      }
      toast.success(`Key "${row.name}" revoked. Requests using it now get 401.`);
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Revoke Key
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke This Key?</AlertDialogTitle>
          <AlertDialogDescription>
            Any integration using <span className="font-mono">{row.prefix}…</span> ({row.name}) stops working
            immediately. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Key</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={revoke}>
            Revoke Key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ApiKeysCard({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createApiKeyAction(name);
      if (!res.ok || !res.data) {
        setError(res.error ?? "Could not create the key.");
        return;
      }
      setCreateOpen(false);
      setName("");
      setSecret(res.data.secret);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Secret keys authenticate your server with the Kusanya API. Each key sees only this business.
        </CardDescription>
        <CardAction>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            Create API Key
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <Empty className="border-border border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRound />
              </EmptyMedia>
              <EmptyTitle>No API Keys Yet</EmptyTitle>
              <EmptyDescription>Create a key to start calling the API from your own systems.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                    <TableCell className="text-muted-foreground">{k.created}</TableCell>
                    <TableCell className="text-muted-foreground">{k.lastUsed ?? "Never"}</TableCell>
                    <TableCell>
                      {k.revoked ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{k.revoked ? null : <RevokeButton row={k} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(open) => !pending && setCreateOpen(open)}>
        <DialogContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>Name the key after the system that will use it.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="api-key-name">Key name</FieldLabel>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ERP sync"
                  maxLength={80}
                  autoFocus
                  aria-invalid={error ? true : undefined}
                />
                <FieldDescription>{error ?? "For example: ERP sync, Shopify orders, Accounting export."}</FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || name.trim().length < 2}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={secret !== null} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Your New Key</DialogTitle>
            <DialogDescription>Store it in your secrets manager or server environment now.</DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>You will only see this key once</AlertTitle>
            <AlertDescription>
              Kusanya keeps only a hash. If you lose the key, revoke it and create a new one.
            </AlertDescription>
          </Alert>
          <div className="bg-muted/60 border-border flex min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 font-mono text-xs break-all select-all">{secret}</code>
            {secret ? <CopyButton text={secret} label="Copy Key" /> : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>I Have Saved It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
