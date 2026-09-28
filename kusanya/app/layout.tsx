import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { AssistDock } from "@/components/assist/assist-dock";
import { A11Y_INIT_SCRIPT } from "@/lib/a11y/prefs";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Kusanya · Invoice-First International Collections", template: "%s · Kusanya" },
  description:
    "Kusanya turns Telegram orders into paid invoices for Kenyan exporters. USD cards and regional mobile money in, KES in your M-Pesa, with every fee shown. Built on Payaza.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved accessibility prefs before first paint (lib/a11y/prefs.ts). */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
      </head>
      <body className={cn("font-sans antialiased", inter.variable, plexMono.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>
            {children}
            <AssistDock />
            <Toaster richColors position="top-right" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
