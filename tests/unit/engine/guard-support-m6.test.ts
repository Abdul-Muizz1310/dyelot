import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { codeFiles, PROBE_DIR, ROOT } from "./guard-support";

// C-HYG6-01 to 03 of docs/specs/06-gallery.md, section 14 (R6-39): codeFiles is never vacuous.

const temp = mkdtempSync(path.join(tmpdir(), "dyelot-code-files-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function tree(name: string, files: readonly string[]): string {
  const root = path.join(temp, name);
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), "");
  }
  return root;
}

const fail = (code: string) => () => {
  throw Object.assign(new Error(code), { code });
};

describe("codeFiles (R6-39)", () => {
  it("C-HYG6-01 lists the code files of a tree and more than 250 under src", () => {
    const root = tree("one", ["a/b.ts", "a/c/d.tsx", "a/e.md", `a/${PROBE_DIR}/x.ts`]);
    expect(codeFiles(path.join(root, "a")).sort()).toEqual(
      [path.join(root, "a/b.ts"), path.join(root, "a/c/d.tsx")].sort(),
    );
    expect(codeFiles(path.join(ROOT, "src")).length).toBeGreaterThan(250);
  });

  it("C-HYG6-02 throws for a missing folder, a folder without code and a failed read", () => {
    expect(() => codeFiles(path.join(temp, "missing"))).toThrow(RangeError);
    expect(() => codeFiles(path.join(temp, "missing"))).toThrow(/^codeFiles:/);
    const docs = tree("docs", ["e.md"]);
    expect(() => codeFiles(docs)).toThrow(RangeError);
    expect(() => codeFiles(docs)).toThrow(/^codeFiles: .* holds no code file/);
    expect(() => codeFiles(3 as unknown as string)).toThrow(TypeError);
    const root = tree("deny", ["k/a.ts", "k/sub/b.ts"]);
    const child = path.join(root, "k/sub");
    const reader = (code: string) =>
      ((folder: string, options: object) =>
        folder === child ? fail(code)() : readdirSync(folder, options as never)) as never;
    for (const code of ["EACCES", "ENOENT"]) {
      expect(() => codeFiles(path.join(root, "k"), reader(code))).toThrow(
        new RegExp(`^codeFiles: cannot read ${child}: ${code}`),
      );
    }
  });

  it("C-HYG6-03 never reads a probe folder and returns every other file", () => {
    const root = tree("probe", ["a/b.ts", `a/${PROBE_DIR}/x.ts`, "a/c/d.ts"]);
    const reads: string[] = [];
    const reader = ((folder: string, options: object) => {
      reads.push(folder);
      if (folder.endsWith(PROBE_DIR)) throw new Error("probe read");
      return readdirSync(folder, options as never);
    }) as never;
    expect(codeFiles(path.join(root, "a"), reader).sort()).toEqual(
      [path.join(root, "a/b.ts"), path.join(root, "a/c/d.ts")].sort(),
    );
    expect(reads.length).toBeGreaterThan(1);
    expect(reads.some((folder) => folder.endsWith(PROBE_DIR))).toBe(false);
  });
});
