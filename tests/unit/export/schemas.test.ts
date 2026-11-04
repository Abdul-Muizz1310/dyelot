import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readSchemaFile, registryValidator } from "./schema-support";

// The vendored schemas and their sources (C-REG-11, R3-28).

describe("C-REG-11 the vendored registry-item schema", () => {
  it("is the file sources.json describes", () => {
    const sources = JSON.parse(readSchemaFile("sources.json")) as Record<
      string,
      { url: string; fetched: string; sha256: string }
    >;
    const entry = sources["registry-item.json"];
    expect(entry?.url).toBe("https://ui.shadcn.com/schema/registry-item.json");
    expect(entry?.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(createHash("sha256").update(readSchemaFile("registry-item.json")).digest("hex")).toBe(
      entry?.sha256,
    );
  });

  it("compiles with Ajv and accepts a minimal theme item", () => {
    const validate = registryValidator();
    expect(
      validate({
        $schema: "https://ui.shadcn.com/schema/registry-item.json",
        name: "x",
        type: "registry:theme",
        cssVars: { light: { primary: "#000000" } },
      }),
    ).toBe(true);
  });
});
