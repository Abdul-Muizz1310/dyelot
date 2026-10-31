import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site/config";
import { ROOT_VIEWPORT, rootMetadata } from "@/lib/site/metadata";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The title is `{ default: SITE.title, template: "%s — dyelot" }`. A template does not apply to a
// title set in the same segment, so the home page sets none and shows the default.
export const metadata: Metadata = rootMetadata(SITE);
export const viewport: Viewport = ROOT_VIEWPORT;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-page font-sans text-foreground">{children}</body>
    </html>
  );
}
