import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FONT_CATALOG, fontFiles } from "@/engine/fonts/catalog";

// Cases are C-FONT-17 to C-FONT-21 of docs/specs/02-studio.md, section 6.2. The script runs with
// `--out <tmp>`: CI runs Vitest before any build, so no `public/fonts` exists.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SCRIPT = path.join(ROOT, "scripts/copy-fonts.mjs");

function run(out: string, cwd = ROOT, extra: string[] = []) {
  return spawnSync(process.execPath, [SCRIPT, "--out", out, ...extra], {
    cwd,
    encoding: "utf8",
  });
}

function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const id of readdirSync(dir)) {
    for (const name of readdirSync(path.join(dir, id))) {
      files[`${id}/${name}`] = readFileSync(path.join(dir, id, name)).toString("base64");
    }
  }
  return files;
}

let work: string;
let out: string;

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), "dyelot-fonts-"));
  out = path.join(work, "out");
  const first = run(out);
  expect(first.status, first.stderr).toBe(0);
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("scripts/copy-fonts.mjs", () => {
  it("C-FONT-17 gives every catalog entry every file of fontFiles, non-empty", () => {
    for (const font of FONT_CATALOG) {
      for (const file of fontFiles(font.id)) {
        const target = path.join(out, font.id, file);
        expect(existsSync(target), `${font.id}/${file}`).toBe(true);
        expect(statSync(target).size, `${font.id}/${file}`).toBeGreaterThan(0);
      }
    }
  });

  it("C-FONT-18 writes real woff2 files and the OFL text", () => {
    for (const font of FONT_CATALOG) {
      for (const file of fontFiles(font.id)) {
        const bytes = readFileSync(path.join(out, font.id, file));
        if (file.endsWith(".woff2")) {
          expect(bytes.subarray(0, 4).toString("latin1"), `${font.id}/${file}`).toBe("wOF2");
        } else {
          expect(bytes.toString("utf8"), font.id).toContain("SIL OPEN FONT LICENSE");
        }
      }
    }
  });

  it("C-FONT-19 holds exactly the 40 catalog directories, each with exactly its files", () => {
    expect(readdirSync(out).sort()).toEqual(FONT_CATALOG.map((font) => font.id).sort());
    for (const font of FONT_CATALOG) {
      expect(readdirSync(path.join(out, font.id)).sort(), font.id).toEqual(
        [...fontFiles(font.id)].sort(),
      );
    }
  });

  it("C-FONT-21 leaves every file byte-identical on a second run", () => {
    const before = snapshot(out);
    const again = run(out);
    expect(again.status, again.stderr).toBe(0);
    expect(snapshot(out)).toEqual(before);
  });

  it("C-FONT-20 exits non-zero and names the id when a Fontsource package is missing", () => {
    // A fixture project: the script, a package.json for module resolution, and a node_modules
    // holding every package but one.
    const fixture = path.join(work, "fixture");
    mkdirSync(path.join(fixture, "scripts"), { recursive: true });
    cpSync(SCRIPT, path.join(fixture, "scripts/copy-fonts.mjs"));
    cpSync(path.join(ROOT, "package.json"), path.join(fixture, "package.json"));
    for (const font of FONT_CATALOG) {
      if (font.id === "onest") continue;
      const scope = font.variable ? "@fontsource-variable" : "@fontsource";
      cpSync(
        path.join(ROOT, "node_modules", scope, font.id),
        path.join(fixture, "node_modules", scope, font.id),
        { recursive: true, dereference: true },
      );
    }
    const target = path.join(work, "out-missing");
    const result = spawnSync(
      process.execPath,
      [path.join(fixture, "scripts/copy-fonts.mjs"), "--out", target],
      { cwd: fixture, encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("onest");
    expect(result.stderr).toContain("@fontsource-variable/onest");
  });

  it("exits non-zero for --out without a directory", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "--out"], { cwd: ROOT, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--out");
  });
});
