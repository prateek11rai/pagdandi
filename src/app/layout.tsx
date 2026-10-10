import type { Metadata, Viewport } from "next";
import { Fraunces, Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces", display: "swap" });
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mukta",
  display: "swap",
});
const tiro = Tiro_Devanagari_Hindi({ subsets: ["devanagari"], weight: "400", variable: "--font-tiro", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pagdandi · India's open trek database", template: "%s · Pagdandi" },
  description:
    "Pick an Indian trek your group can actually do, get daily updates until you leave, then put the phone away.",
  icons: { icon: "/brand/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#141c17" },
  ],
};

// Runs before first paint: the saved theme, or the system preference.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={`${fraunces.variable} ${mukta.variable} ${tiro.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-paper text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
