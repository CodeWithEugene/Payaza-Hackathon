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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kusanya.codewitheugene.top";
const SHARE_TITLE = "Kusanya: Get Paid For Your Exports, Without The Chase";
const SHARE_DESCRIPTION =
  "Turn buyer orders from Telegram, USSD or SMS into paid invoices. Buyers abroad pay by card, Apple Pay, Google Pay or mobile money, and you receive KES in M-Pesa with every fee shown. Built on Payaza.";

// Link previews (WhatsApp, Slack, X, LinkedIn) read openGraph/twitter; the
// image comes from app/opengraph-image.png + app/twitter-image.png.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Kusanya · Invoice-First International Collections", template: "%s · Kusanya" },
  description: SHARE_DESCRIPTION,
  applicationName: "Kusanya",
  openGraph: {
    type: "website",
    siteName: "Kusanya",
    url: "/",
    locale: "en_KE",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SHARE_TITLE, description: SHARE_DESCRIPTION },
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
