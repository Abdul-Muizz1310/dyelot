import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";

// Breaks when the `@/` alias stops resolving to `src/`, when `src/lib/site/config.ts` is
// missing, or when a config copied from a sibling product still carries the sibling's name.
describe("site config", () => {
  it("is reachable through the @/ alias and names the product dyelot", () => {
    expect(SITE.name).toBe("dyelot");
  });
});
