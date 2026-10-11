import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Eczar } from "next/font/google";
import { connection } from "next/server";
import { Sidebar } from "@/components/nav";
import { TabBar } from "@/components/tab-bar";
import { TopoBackdrop } from "@/components/topo-pattern";
import "./globals.css";

// Headings, the logotype and trek names in Eczar; everything else in Anek Devanagari. Both cover Devanagari.
const eczar = Eczar({ subsets: ["latin", "devanagari"], variable: "--font-eczar", display: "swap" });
const anek = Anek_Devanagari({ subsets: ["latin", "devanagari"], variable: "--font-anek", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pagdandi · India's open trek database", template: "%s · Pagdandi" },
  description:
    "Tell the guide about your group and pick an Indian trek you can actually do. Every fact is sourced, and the guide runs on Gemma on the machine serving the site.",
  icons: { icon: "/brand/logo.svg" },
};

export const viewport: Viewport = { themeColor: "#f6f1e7" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every page renders per request, so Next can put this request's CSP nonce (src/proxy.ts) on its scripts.
  await connection();
  return (
    <html lang="en-IN" className={`${eczar.variable} ${anek.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="min-h-dvh shell:grid shell:grid-cols-[272px_minmax(0,1fr)]">
          <Sidebar />
          <main id="main" className="relative isolate min-h-dvh min-w-0 pb-16 shell:pb-0">
            <TopoBackdrop />
            {children}
          </main>
        </div>
        <TabBar />
      </body>
    </html>
  );
}
