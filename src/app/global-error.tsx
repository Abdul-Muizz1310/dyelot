"use client";

import { Geist_Mono } from "next/font/google";
import { useEffect } from "react";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import "./globals.css";

// This boundary replaces the root layout while it is active, so it renders its own <html> and
// <body> and loads its own stylesheet and font. It cannot export `metadata`: the <title> element
// names the tab instead. Next 16.4 passes `error` as `unknown`, and `retry` re-fetches the root
// where `reset` would not. The retry button is a flex container, which would collapse the trailing
// space in the decorative `$ ` marker, so the marker's span is `whitespace-pre`.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${geistMono.variable} antialiased`}>
      <body className="bg-page font-mono text-foreground">
        <title>something broke — dyelot</title>
        <main className="flex min-h-dvh flex-col px-4 py-8 md:px-6">
          <TerminalWindow title="error.log" className="mx-auto my-auto w-full max-w-xl">
            <div className="space-y-3">
              <h1 className="font-mono text-xl font-semibold tracking-tight">something broke</h1>
              <Prompt kind="comment">the site failed to load. try again.</Prompt>
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-8 items-center font-mono text-sm text-accent-madder"
              >
                <span aria-hidden="true" className="whitespace-pre">
                  {"$ "}
                </span>
                retry
              </button>
            </div>
          </TerminalWindow>
        </main>
      </body>
    </html>
  );
}
