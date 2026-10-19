import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppNav, NavLinks } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BolBindass — your English speaking partner", template: "%s · BolBindass" },
  description:
    "Practise spoken English with a friendly local AI coach. Runs on your own computer with Ollama — no paid APIs, ₹0.",
};

export const viewport: Viewport = {
  themeColor: "#f8f3e9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={300}>
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Brand />
              <Suspense fallback={<NavLinks />}>
                <AppNav />
              </Suspense>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          <footer className="border-t border-border/70">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
              <p>Runs on your computer · Local AI via Ollama · ₹0, no paid APIs</p>
              <p>Your transcripts and progress stay in this browser.</p>
            </div>
          </footer>
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
