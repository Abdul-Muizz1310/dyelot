import { describe, expect, it } from "vitest";

// Breaks when the `@/` alias stops resolving to `src/`, when `src/lib/site/config.ts` is
// missing, or when a config copied from a sibling product still carries the sibling's name.
//
// The specifier is a variable so this file typechecks before the module exists: a literal
// `import("@/lib/site/config")` fails `tsc --noEmit` with TS2307. `unknown` keeps the loose
// import out of the type graph.
const SITE_CONFIG_MODULE = "@/lib/site/config";

describe("site config", () => {
  it("is reachable through the @/ alias and names the product dyelot", async () => {
    const config: unknown = await import(SITE_CONFIG_MODULE);
    expect(config).toHaveProperty("SITE.name", "dyelot");
  });
});
