// A file imported with `?raw` is its text. Vitest handles the query itself; a Turbopack rule in
// next.config.ts serves it as a string for the build (R3-39).
declare module "*.mjs?raw" {
  const text: string;
  export default text;
}

// The prompt files of src/ai/prompts are text the same way (R4-27, R4-51).
declare module "*.md?raw" {
  const text: string;
  export default text;
}
