import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SignupForm } from "@/components/auth/signup-form";
import { BrandPanel } from "@/components/auth/brand-panel";
import { ModeToggle } from "@/components/mode-toggle";
import { KusanyaMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />
      <div className="bg-muted/30 relative flex flex-col items-center justify-center p-4 py-10 md:p-8">
        <Button variant="ghost" size="sm" asChild className="absolute left-4 top-4">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            Home
          </Link>
        </Button>
        <div className="absolute right-4 top-4">
          <ModeToggle />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          {/* Compact brand — mobile only (desktop gets the BrandPanel) */}
          <div className="flex flex-col items-center gap-2 lg:hidden">
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
    </div>
  );
}
