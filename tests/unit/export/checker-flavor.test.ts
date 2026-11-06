import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type CheckIo, main, nodeIo } from "@/export/checker/dyelot-check.mjs";
import { cleanFolders, FLAVOR_APP } from "./checker-support";

// C-FEX-16 and C-FEX-17 of docs/specs/05-motion-3d.md, section 14.4 (R5-26): the bundled checker on
// an app that holds the flavor files and moved copies of four of them.

afterAll(cleanFolders);

type Report = {
  result: string;
  checked: { files: number };
  findings: { code: string; path: string; line: number; text: string }[];
};

function check(dir: string): { code: number; out: string; report: Report } {
  const out: string[] = [];
  const io: CheckIo = { ...nodeIo, cwd: dir, out: (text) => out.push(text), err: () => {} };
  const code = main(["--root", dir, "--json"], io);
  return { code, out: out.join(""), report: JSON.parse(out.join("")) as Report };
}

describe("the checker on an app with the flavor files", () => {
  it("C-FEX-16 passes, and counts globals.css and the four moved copies", () => {
    const { code, report } = check(FLAVOR_APP());
    expect(report.findings).toEqual([]);
    expect(code).toBe(0);
    expect(report.result).toBe("PASS");
    expect(report.checked.files).toBe(5);
  });

  it("C-FEX-17 fails on a raw color added to the moved flavor.css, at that path and line", () => {
    const moved = path.join("src/components/flavor.css");
    const clean = readFileSync(path.join(FLAVOR_APP(), moved), "utf8");
    const lines = clean.split("\n");
    const close = lines.lastIndexOf("}");
    const edited = [...lines.slice(0, close), "  color: #ff0000;", ...lines.slice(close)].join(
      "\n",
    );
    const { code, report } = check(FLAVOR_APP({ [moved]: edited }));
    expect(code).toBe(1);
    const raw = report.findings.filter((finding) => finding.code === "raw-color");
    expect(raw.map((finding) => [finding.path, finding.line, finding.text])).toEqual([
      [moved, close + 1, "#ff0000"],
    ]);
  });
});
