import type { ReactNode } from "react";

type Kind = "input" | "output" | "comment";

// One entry per kind, so a new kind fails to compile until every table names it.
const MARKER: Record<Kind, string> = { input: "$", output: ">", comment: "//" };
const MARKER_CLASS: Record<Kind, string> = {
  input: "text-fg-muted",
  output: "text-accent-madder",
  comment: "text-fg-muted italic",
};
const TEXT_CLASS: Record<Kind, string> = {
  input: "text-foreground",
  output: "text-foreground font-semibold",
  comment: "text-fg-muted italic",
};

export type PromptProps = {
  kind?: Kind;
  children?: ReactNode;
  className?: string;
  /** A blinking block after the text: an idle prompt. */
  cursor?: boolean;
};

/**
 * One line of a fake terminal: `$` for input, `>` for output, `//` for comments. The marker is
 * decoration, so assistive technology skips it and a selection copies the command alone.
 */
export function Prompt({ kind = "input", children, className = "", cursor = false }: PromptProps) {
  return (
    <div className={`flex items-baseline gap-2.5 font-mono text-sm ${className}`}>
      <span aria-hidden="true" className={`select-none ${MARKER_CLASS[kind]}`}>
        {MARKER[kind]}
      </span>{" "}
      {children !== undefined && (
        <span className={`min-w-0 [overflow-wrap:anywhere] ${TEXT_CLASS[kind]}`}>{children}</span>
      )}
      {cursor && (
        <span
          aria-hidden="true"
          className="cursor-blink ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-accent-madder"
        />
      )}
    </div>
  );
}
