import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine";
import { buildBundle } from "@/export/bundle";
import { CHECKER_SOURCE } from "@/export/checker/source";
import { sha256 } from "@/export/sha256";
import { editLink, slug } from "@/export/text";
import { zipBundle } from "@/export/zip";
import { encodeSpec, lotTag, specId } from "@/spec";
import { DEFAULT_PARAMS } from "../spec/support";
import { BUNDLE, LONG_NAME } from "./bundle-support";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";

// C-BND-01 to 05 and 07, C-RCPT-08's bundle half, C-RCPT-10 and C-CHK-25's byte half of
// docs/specs/03-export.md, sections 10.6, 10.7 and 10.9 (R3-09, R3-12). C-BND-06 lives in golden.test.ts.

const encoder = new TextEncoder();
const FIXED_TAIL = [
  "tokens/base.tokens.json",
  "tokens/light.tokens.json",
  "tokens/dark.tokens.json",
  "tokens/design.resolver.json",
  "tokens/figma/light.tokens.json",
  "tokens/figma/dark.tokens.json",
  "design.toon",
  "motion/motion.css",
  "motion/motion.ts",
  "motion/gsap.ts",
];

const paths = (bundle: { files: readonly { path: string }[] }) => bundle.files.map((f) => f.path);

describe("buildBundle files", () => {
  it("C-BND-01: lists the 20 paths of R3-12 in order", () => {
    expect(paths(BUNDLE)).toEqual([
      "DESIGN.md",
      "AGENTS.md.snippet",
      "prompt.md",
      "app/theme.css",
      "registry/untitled.json",
      "registry/font-host-grotesk.json",
      "registry/font-fragment-mono.json",
      ...FIXED_TAIL,
      "skills/untitled-design/SKILL.md",
      "scripts/dyelot-check.mjs",
      "receipt.json",
    ]);
    expect(BUNDLE.files).toHaveLength(20);
  });

  it("C-BND-02: every file of every golden obeys R3-09", () => {
    for (const { id, spec } of GOLDENS) {
      const { files } = buildBundle({ spec, origin: ORIGIN });
      expect(files.length, id).toBeGreaterThanOrEqual(18);
      expect(files.length, id).toBeLessThanOrEqual(21);
      for (const file of files) {
        const who = `${id}: ${file.path}`;
        // R3-09's character set, with the three fixed capitals of R3-12's file names.
        expect(file.path.replace(/DESIGN\.md|AGENTS\.md\.snippet|SKILL\.md/, "x"), who).toMatch(
          /^[a-z0-9._/-]+$/,
        );
        expect(file.path.startsWith("/") || file.path.startsWith("."), who).toBe(false);
        expect(file.path, who).not.toContain("..");
        expect(file.text, who).not.toContain("\r");
        expect(file.text.startsWith("﻿"), who).toBe(false);
        expect(file.text, who).not.toMatch(/[ \t]$/m);
        if (file.path === "design.toon") {
          expect(file.text.endsWith("\n"), who).toBe(false);
        } else {
          expect(file.text.endsWith("\n"), who).toBe(true);
          expect(file.text.endsWith("\n\n"), who).toBe(false);
        }
      }
    }
  });

  it("C-BND-03: slug, ids, link, receipt and summary", () => {
    const id = specId(SPEC);
    expect(BUNDLE.slug).toBe("untitled");
    expect(BUNDLE.specId).toBe(id);
    expect(BUNDLE.lot).toBe(lotTag(id));
    expect(BUNDLE.link).toBe(`${ORIGIN}/studio#s=${encodeSpec(SPEC)}`);
    expect(BUNDLE.link).toBe(editLink(SPEC, ORIGIN));
    const last = BUNDLE.files[BUNDLE.files.length - 1];
    expect(last?.path).toBe("receipt.json");
    expect(BUNDLE.receipt).toEqual(JSON.parse(last?.text as string));
    expect(BUNDLE.summary).toEqual(BUNDLE.receipt.summary);
  });

  it("C-BND-04: font items follow the distinct loadable families", () => {
    const fontPaths = (b: { files: readonly { path: string }[] }) =>
      paths(b).filter((p) => p.startsWith("registry/font-"));
    const three = GOLDENS.find((g) => g.id === "default")?.spec as typeof SPEC;
    const { display, body, mono } = three.type.families;
    expect(new Set([display, body, mono]).size).toBe(3);
    const b3 = buildBundle({ spec: three, origin: ORIGIN });
    expect(b3.files).toHaveLength(21);
    expect(fontPaths(b3)).toEqual([display, body, mono].map((f) => `registry/font-${f}.json`));

    const redaction = generateSystem({ ...DEFAULT_PARAMS, pairing: "redaction-redhat" }, "seed-1");
    expect(redaction.type.families.display).toBe("redaction");
    expect(fontPaths(buildBundle({ spec: redaction, origin: ORIGIN }))).not.toContain(
      "registry/font-redaction.json",
    );

    const outside = structuredClone(SPEC);
    outside.type.families.mono = "not-in-the-catalog";
    expect(fontPaths(buildBundle({ spec: outside, origin: ORIGIN }))).toEqual([
      "registry/font-host-grotesk.json",
    ]);

    const shared = JSON.parse(
      BUNDLE.files.find((f) => f.path === "registry/font-host-grotesk.json")?.text as string,
    );
    expect(JSON.stringify(shared)).toContain("--font-sans");
  });

  it("C-BND-05: a spec with its keys in another order gives the same files", () => {
    const shuffled = Object.fromEntries(Object.entries(SPEC).reverse()) as typeof SPEC;
    expect(Object.keys(shuffled)).not.toEqual(Object.keys(SPEC));
    expect(buildBundle({ spec: shuffled, origin: ORIGIN }).files).toEqual(BUNDLE.files);
  });

  it("C-BND-03: the name feeds the slug", () => {
    const spec = structuredClone(SPEC);
    spec.meta.name = LONG_NAME;
    expect(buildBundle({ spec, origin: ORIGIN }).slug).toBe(slug(LONG_NAME));
  });
});

describe("buildBundle failures", () => {
  it("C-BND-07: bad origins, specs and inputs", () => {
    for (const origin of [
      "http://dyelot.vercel.app",
      "https://dyelot.vercel.app/",
      "https://dyelot.vercel.app/studio",
      "https://dyelot.vercel.app?x=1",
      "https://dyelot.vercel.app#x",
      "",
    ]) {
      expect(() => buildBundle({ spec: SPEC, origin }), origin).toThrow(RangeError);
      expect(() => buildBundle({ spec: SPEC, origin }), origin).toThrow(/buildBundle/);
    }
    expect(() => buildBundle({ spec: SPEC, origin: 42 as never })).toThrow(TypeError);
    expect(() => buildBundle({ spec: SPEC, origin: 42 as never })).toThrow(/buildBundle/);
    expect(() => buildBundle({ spec: { nope: 1 } as never, origin: ORIGIN })).toThrow(RangeError);
    for (const input of [null, 5, "x", undefined]) {
      expect(() => buildBundle(input as never)).toThrow(TypeError);
      expect(() => buildBundle(input as never)).toThrow(/buildBundle/);
    }
  });
});

describe("the receipt and the checker in the bundle", () => {
  it("C-RCPT-08: the receipt lists every other file in order with its bytes and hash", () => {
    const others = BUNDLE.files.slice(0, -1);
    expect(BUNDLE.receipt.files.map((f: { path: string }) => f.path)).toEqual(
      paths({ files: others }),
    );
    others.forEach((file, i) => {
      expect(BUNDLE.receipt.files[i]).toEqual({
        path: file.path,
        bytes: encoder.encode(file.text).length,
        sha256: sha256(file.text),
      });
    });
  });

  it("C-RCPT-10: for each golden the receipt is the last file parsed and the summary is its summary", () => {
    for (const { id, spec } of GOLDENS) {
      const bundle = buildBundle({ spec, origin: ORIGIN });
      const last = bundle.files[bundle.files.length - 1];
      expect(last?.path, id).toBe("receipt.json");
      expect(bundle.receipt, id).toEqual(JSON.parse(last?.text as string));
      expect(bundle.summary, id).toEqual(bundle.receipt.summary);
    }
  });

  it("C-CHK-25: scripts/dyelot-check.mjs is CHECKER_SOURCE and the source file", () => {
    const file = BUNDLE.files.find((f) => f.path === "scripts/dyelot-check.mjs");
    const source = readFileSync(
      path.join(process.cwd(), "src/export/checker/dyelot-check.mjs"),
      "utf8",
    );
    expect(file?.text).toBe(CHECKER_SOURCE);
    expect(file?.text).toBe(source);
  });

  it("C-CHK-25: the unzipped bundle passes the spawned checker", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dyelot-bundle-"));
    try {
      for (const [name, bytes] of Object.entries(unzipSync(zipBundle(BUNDLE)))) {
        const target = path.join(dir, name);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, bytes);
      }
      writeFileSync(path.join(dir, "app/globals.css"), '@import "./theme.css";\n');
      const r = spawnSync(process.execPath, ["scripts/dyelot-check.mjs"], {
        cwd: dir,
        encoding: "utf8",
      });
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(r.stdout.trimEnd().split("\n").pop()).toBe("PASS");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
