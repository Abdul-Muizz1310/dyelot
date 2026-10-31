import type { ReactNode } from "react";

export type TerminalWindowProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * A window frame for content: three neutral dots, a centered title and a panel body. The dots are
 * gray, not red, yellow and green, because the chrome stays achromatic apart from madder.
 */
export function TerminalWindow({ title, children, className = "" }: TerminalWindowProps) {
  return (
    <section className={`terminal-glow min-w-0 overflow-hidden rounded-xl bg-panel ${className}`}>
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <div aria-hidden="true" className="flex w-12 items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-border-bright" />
          <span className="inline-block h-3 w-3 rounded-full bg-border-bright" />
          <span className="inline-block h-3 w-3 rounded-full bg-border-bright" />
        </div>
        <div className="flex-1 text-center font-mono text-xs text-fg-muted">{title}</div>
        <div aria-hidden="true" className="w-12" />
      </header>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}
