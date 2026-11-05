import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBundle } from "@/export/bundle";
import { sha256 } from "@/export/sha256";
import { zipBundle } from "@/export/zip";
import { GOLDENS, ORIGIN } from "./golden-support";

// C-BND-06 and C-ZIP-04's golden half of docs/specs/03-export.md (R3-27). `DYELOT_UPDATE_GOLDENS=1`
// rewrites tests/golden/export/manifest.json and the `default` files; it fails together with `CI`.

const DIR = path.join(process.cwd(), "tests/golden/export");
const MANIFEST = path.join(DIR, "manifest.json");
const encoder = new TextEncoder();

type Entry = {
  specId: string;
  files: { path: string; bytes: number; sha256: string }[];
  zipSha256: string;
};

function measure(spec: (typeof GOLDENS)[number]["spec"]) {
  const bundle = buildBundle({ spec, origin: ORIGIN });
  const entry: Entry = {
    specId: bundle.specId,
    files: bundle.files.map((f) => ({
      path: f.path,
      bytes: encoder.encode(f.text).length,
      sha256: sha256(f.text),
    })),
    zipSha256: sha256(zipBundle(bundle)),
  };
  return { bundle, entry };
}

const UPDATE = process.env.DYELOT_UPDATE_GOLDENS === "1";

describe("the goldens", () => {
  if (UPDATE) {
    it("C-BND-06: rewrites the goldens, and never in CI", () => {
      expect(process.env.CI, "DYELOT_UPDATE_GOLDENS must not run in CI").toBeUndefined();
      const manifest: Record<string, Entry> = {};
      for (const { id, spec } of GOLDENS) {
        const { bundle, entry } = measure(spec);
        manifest[id] = entry;
        if (id === "default") {
          rmSync(path.join(DIR, "default"), { recursive: true, force: true });
          for (const file of bundle.files) {
            const target = path.join(DIR, "default", file.path);
            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, file.text);
          }
        }
      }
      mkdirSync(DIR, { recursive: true });
      writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    });
    return;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, Entry>;

  it("C-BND-06: the manifest names the 15 goldens", () => {
    expect(Object.keys(manifest)).toEqual(GOLDENS.map((g) => g.id));
    expect(process.env.DYELOT_UPDATE_GOLDENS === "1" && process.env.CI !== undefined).toBe(false);
  });

  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))(
    "C-BND-06: the %s golden matches the manifest",
    (id, spec) => {
      const { entry } = measure(spec);
      expect(entry).toEqual(manifest[id]);
    },
  );

  it("C-BND-06 and C-ZIP-04: the default golden's files equal the committed files", () => {
    const golden = GOLDENS.find((g) => g.id === "default") as (typeof GOLDENS)[number];
    const { bundle, entry } = measure(golden.spec);
    for (const file of bundle.files) {
      expect(file.text, file.path).toBe(readFileSync(path.join(DIR, "default", file.path), "utf8"));
    }
    expect(entry.zipSha256).toBe(manifest.default?.zipSha256);
  });
});
