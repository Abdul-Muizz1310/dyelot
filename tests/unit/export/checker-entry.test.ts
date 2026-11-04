import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CHECKER_SOURCE } from "@/export/checker/source";
import { APP, cleanFolders } from "./checker-support";

// C-CHK-24 and C-CHK-26 of docs/specs/03-export.md, section 10.7: the checker as a script, spawned.

afterAll(cleanFolders);

const SOURCE = path.join(process.cwd(), "src/export/checker/dyelot-check.mjs");
const TEXT = readFileSync(SOURCE, "utf8");

describe("the checker as a script", () => {
  it("C-CHK-31: CHECKER_SOURCE is the file's text, byte for byte", () => {
    expect(CHECKER_SOURCE).toBe(TEXT);
  });

  it("C-CHK-24: spawned in an APP folder, with Node 18 APIs and five imports at most", () => {
    const dir = APP();
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    copyFileSync(SOURCE, path.join(dir, "scripts/dyelot-check.mjs"));
    const r = spawnSync(process.execPath, ["scripts/dyelot-check.mjs", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.result).toBe("PASS");
    expect(r.stdout).toBe(`${JSON.stringify(report, null, 2)}\n`);

    const allowed = new Set(["node:fs", "node:path", "node:url", "node:crypto", "node:process"]);
    const imported = [...TEXT.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1],
    );
    expect(imported.length).toBeGreaterThan(0);
    for (const name of imported) expect(allowed.has(name as string), name).toBe(true);
    expect(TEXT).not.toMatch(/\bimport\s*\(/);
    expect(TEXT).not.toMatch(/\brequire\s*\(/);
    expect(TEXT.match(/^import\s/gm)).toHaveLength(imported.length);
    for (const banned of [
      "toSorted",
      "toReversed",
      "toSpliced",
      "Object.groupBy",
      "Promise.withResolvers",
      "Array.fromAsync",
      "import.meta.dirname",
      "import.meta.filename",
      "globSync",
      "styleText",
      "loadEnvFile",
    ]) {
      expect(TEXT, banned).not.toContain(banned);
    }
  });

  it("C-CHK-26: importing runs nothing; a symbolic link runs it as the entry", () => {
    const imported = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(SOURCE)})`],
      { encoding: "utf8" },
    );
    expect(imported.status).toBe(0);
    expect(imported.stdout).toBe("");
    expect(imported.stderr).toBe("");

    const dir = APP();
    const link = path.join(dir, "check-link.mjs");
    symlinkSync(SOURCE, link);
    const r = spawnSync(process.execPath, [link, "--json"], { cwd: dir, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).result).toBe("PASS");
  });
});
