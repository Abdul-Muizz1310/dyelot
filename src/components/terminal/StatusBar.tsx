import type { ReactNode } from "react";

export type StatusBarProps = {
  left?: ReactNode;
  right?: ReactNode;
};

/**
 * The terminal-style strip under the content. It flows with the document (`mt-auto` pushes it to
 * the bottom of the flex column), so it sits beneath long pages and at the viewport bottom on
 * short ones.
 */
export function StatusBar({ left, right }: StatusBarProps) {
  return (
    <footer className="z-30 mt-auto w-full border-t border-border bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-8 max-w-[1400px] items-center justify-between gap-4 px-4 font-mono text-[11px] text-fg-muted md:px-6">
        <span className="truncate">{left}</span>
        <span className="shrink-0">{right}</span>
      </div>
    </footer>
  );
}
