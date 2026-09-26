"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, UserPlus } from "lucide-react";

import { signUpWithBusiness } from "@/lib/actions/auth";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const MPESA_PATTERN = /^\+?254\d{9}$/;

/** Normalize what a Kenyan would actually type: "0712 345 678" → "254712345678". */
function normalizeMpesa(raw: string): string {
  const stripped = raw.replace(/[\s-]/g, "");
  return stripped.startsWith("0") ? `254${stripped.slice(1)}` : stripped;
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("KE");
  const [phone, setPhone] = useState("");
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedMpesa = normalizeMpesa(mpesaNumber);
  const mpesaInvalid =
    normalizedMpesa.length > 0 && !MPESA_PATTERN.test(normalizedMpesa);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || mpesaInvalid) return;
    setBusy(true);
    setError(null);
    const result = await signUpWithBusiness({
      name: name.trim(),
      email: email.trim(),
      password,
      businessName: businessName.trim(),
      country,
      phone: phone.replace(/[\s-]/g, ""),
      mpesaNumber: normalizedMpesa,
    });
    if (!result.ok) {
      setBusy(false);
      const message = result.error ?? "Signup failed. Try again in a moment.";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Karibu! Let's get you paid.");
    router.push("/app");
    router.refresh();
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your Kusanya account</CardTitle>
        <CardDescription>
          One form sets up your login, your business profile and your default
          M-Pesa payout rail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Couldn&apos;t create your account</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="signup-name">Your name</FieldLabel>
              <Input
                id="signup-name"
                type="text"
                required
                autoComplete="name"
                placeholder="Wanjiru Kamau"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.co.ke"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <Input
                id="signup-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-business">Business name</FieldLabel>
              <Input
                id="signup-business"
                type="text"
                required
                autoComplete="organization"
                placeholder="FreshLeaf Exports Ltd"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-country">Country</FieldLabel>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="signup-country" className="w-full">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="KE">Kenya</SelectItem>
                    <SelectItem value="UG">Uganda</SelectItem>
                    <SelectItem value="TZ">Tanzania</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Where your business is registered. Kenya by default.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-phone">
                Your phone (optional)
              </FieldLabel>
              <Input
                id="signup-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+254 7XX XXX XXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>

            <Field data-invalid={mpesaInvalid || undefined}>
              <FieldLabel htmlFor="signup-mpesa">
                M-Pesa number for payouts (optional)
              </FieldLabel>
              <Input
                id="signup-mpesa"
                type="tel"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={mpesaNumber}
                onChange={(event) => setMpesaNumber(event.target.value)}
                aria-invalid={mpesaInvalid || undefined}
              />
              {mpesaInvalid ? (
                <FieldError>
                  Enter a valid Safaricom number, e.g. 0712 345 678
                </FieldError>
              ) : (
                <FieldDescription>
                  Becomes your default payout rail — where your KES lands.
                </FieldDescription>
              )}
            </Field>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UserPlus data-icon="inline-start" />
              )}
              {busy ? "Setting up your account…" : "Create account"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground hover:text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
