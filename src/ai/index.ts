// The AI entry (R4-04, section 5.2 of docs/specs/04-ai.md): only `export … from` lines. App code
// reaches it through `import()`, or with a type-only import. Later tasks add 5.2's runtime names.

export type { AiChange, AiPatch } from "./apply";
