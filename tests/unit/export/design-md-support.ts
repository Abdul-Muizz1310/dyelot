import { parse } from "yaml";

// Shared readers of a written DESIGN.md for the Task 3.9 tests.

/** The front matter text and the body that follows it. */
export function splitFrontMatter(text: string): { front: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) throw new Error("no front matter");
  return { front: match[1] as string, body: match[2] as string };
}

/** The front matter parsed the way R3-32 reads it. */
export function parseFront(text: string): Record<string, unknown> {
  return parse(splitFrontMatter(text).front, { schema: "core", uniqueKeys: true }) as Record<
    string,
    unknown
  >;
}

/** A text with its fenced code blocks removed. */
export function outsideFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

/** The lines of the body outside fences. */
export function bodyLines(text: string): string[] {
  return outsideFences(splitFrontMatter(text).body).split("\n");
}
