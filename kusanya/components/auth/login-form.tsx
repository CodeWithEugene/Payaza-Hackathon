"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, LogIn, Wand2 } from "lucide-react";

import { authClient } from "@/lib/auth/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

const DEMO_EMAIL = "wanjiru@kusanya.demo";
const DEMO_PASSWORD = "kusanya-demo-2026";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(
        signInError.message ??
          "We couldn't sign you in. Check your email and password, then try again.",
      );
      return;
    }
    router.push("/app");
    router.refresh();
  }

  function fillDemoCredentials() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Pick up your collections where you left them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              {error ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Couldn&apos;t sign you in</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@business.co.ke"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  aria-invalid={error ? true : undefined}
                />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  aria-invalid={error ? true : undefined}
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <LogIn data-icon="inline-start" />
                )}
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-muted-foreground text-sm">
            New to Kusanya?{" "}
            <Link
              href="/signup"
              className="text-foreground hover:text-primary underline underline-offset-4"
            >
              Create your account
            </Link>
          </p>
        </CardFooter>
      </Card>

      <Separator />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Judging the demo?</CardTitle>
          <CardDescription>
            Skip signup — step into Wanjiru&apos;s account at FreshLeaf Exports.
            Her story is already mid-flight.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3 font-mono text-xs">
            <span>{DEMO_EMAIL}</span>
            <span>{DEMO_PASSWORD}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={fillDemoCredentials}
          >
            <Wand2 data-icon="inline-start" />
            Fill demo credentials
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
