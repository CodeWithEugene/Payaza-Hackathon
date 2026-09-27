import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "@/components/auth/signup-form";
import { ModeToggle } from "@/components/mode-toggle";
import { KusanyaMark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="bg-muted/30 relative grid min-h-screen place-items-center p-4">
      <div className="absolute right-4 top-4">
        <ModeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6 py-8">
        <div className="flex flex-col items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <KusanyaMark className="size-8" />
            <span className="font-heading text-xl font-semibold tracking-tight">
              kusanya
            </span>
          </Link>
          <p className="text-muted-foreground text-xs">
            Invoice-first international collections
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
