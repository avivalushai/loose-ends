import type { Metadata } from "next";
import Link from "next/link";
import { clerkConfigured, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loose Ends — the board Claude keeps while you build",
  description:
    "A feature board Claude keeps for you per project: what's in progress, what you left halfway, what's done. Your code and plans never leave your machine.",
  metadataBase: new URL(SITE_URL),
  openGraph: { title: "Loose Ends", description: "The board Claude keeps while you build.", url: SITE_URL, type: "website" },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="wrap">
          <header className="top">
            <Link className="brand" href="/">
              <span className="mark" aria-hidden="true" />
              Loose Ends
            </Link>
            <nav>
              <Link href="/app">Open my board</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
          </header>
          {children}
          <footer className="foot">
            <span>Your boards live in your repos. We never see them.</span>
            <Link href="/privacy">What we store</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  if (!clerkConfigured()) return <Shell>{children}</Shell>;
  const { ClerkProvider } = await import("@clerk/nextjs");
  return (
    <ClerkProvider>
      <Shell>{children}</Shell>
    </ClerkProvider>
  );
}
