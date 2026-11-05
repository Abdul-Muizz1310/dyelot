import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CONTRAST_CHECKS,
  generateSystem,
  hexToRgb,
  lintSpec,
  measureSpec,
  perceptualLc,
  presetOf,
  ROLE_NAMES,
  summarize,
  wcagRatio,
} from "@/engine";
import { fmt4, round1, trunc4 } from "@/export/format";
import { RECEIPT_FORMAT, receiptJson } from "@/export/receipt";
import { sha256 } from "@/export/sha256";
import { themeCss } from "@/export/theme-css";
import { type DesignSpec, encodeSpec, lotTag, specId } from "@/spec";
import { DEFAULT_PARAMS } from "../spec/support";
import { STUB_FILES } from "./checker-support";
import { ORIGIN, SPEC } from "./golden-support";

// C-RCPT-01 to 09 of docs/specs/03-export.md, section 10.6 (R3-08, R3-23, section 7.1).

// biome-ignore lint/suspicious/noExplicitAny: parsed receipt JSON, read by key
type Json = Record<string, any>;
const SEED = 3008;
const RECEIPT_TEXT = receiptJson(SPEC, STUB_FILES, ORIGIN);
const RECEIPT = JSON.parse(RECEIPT_TEXT) as Json;
type Mode = "light" | "dark";

function overlay(spec: DesignSpec, mode: Mode, roles: Record<string, string>): DesignSpec {
  return {
    ...spec,
    color: {
      ...spec.color,
      roles: { ...spec.color.roles, [mode]: { ...spec.color.roles[mode], ...roles } },
    },
  };
}

const receiptOf = (spec: DesignSpec): Json =>
  JSON.parse(receiptJson(spec, STUB_FILES, ORIGIN)) as Json;

const hexOf = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const channelL = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lumOf = (r: number, g: number, b: number): number =>
  0.2126 * channelL(r) + 0.7152 * channelL(g) + 0.0722 * channelL(b);

/** A dark-on-light pair whose WCAG ratio lies in [4.4999, 4.5), found by search. */
function nearMiss(): { fg: string; bg: string } {
  const lights: { l: number; hex: string }[] = [];
  for (let r = 0xf0; r <= 0xff; r++) {
    for (let g = 0xf0; g <= 0xff; g++) {
      for (let b = 0xf0; b <= 0xff; b++) lights.push({ l: lumOf(r, g, b), hex: hexOf(r, g, b) });
    }
  }
  lights.sort((x, y) => x.l - y.l);
  for (let r = 0x6c; r <= 0x76; r++) {
    for (let g = 0x6c; g <= 0x76; g++) {
      for (let b = 0x6c; b <= 0x76; b++) {
        const target = 4.49995 * (lumOf(r, g, b) + 0.05) - 0.05;
        let lo = 0;
        let hi = lights.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if ((lights[mid]?.l as number) < target) lo = mid + 1;
          else hi = mid;
        }
        const fg = hexOf(r, g, b);
        const bg = lights[lo]?.hex as string;
        const full = wcagRatio(hexToRgb(fg as never), hexToRgb(bg as never));
        if (full >= 4.4999 && full < 4.5) return { fg, bg };
      }
    }
  }
  throw new Error("no near-miss pair found");
}

describe("receiptJson", () => {
  it("C-RCPT-01: key order, JSON text, format, determinism and no clock", () => {
    expect(RECEIPT_TEXT).toBe(`${JSON.stringify(RECEIPT, null, 2)}\n`);
    expect(Object.keys(RECEIPT)).toEqual([
      "format",
      "generator",
      "design",
      "summary",
      "contrast",
      "separation",
      "gamut",
      "roles",
      "radius",
      "findings",
      "files",
    ]);
    expect(RECEIPT.format).toBe(RECEIPT_FORMAT);
    expect(RECEIPT_FORMAT).toBe("dyelot.check/1");
    expect(receiptJson(SPEC, STUB_FILES, ORIGIN)).toBe(RECEIPT_TEXT);
    const saved = process.env.TZ;
    try {
      for (const tz of ["UTC", "Asia/Kolkata"]) {
        process.env.TZ = tz;
        expect(receiptJson(SPEC, STUB_FILES, ORIGIN)).toBe(RECEIPT_TEXT);
      }
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
    expect(RECEIPT_TEXT).not.toMatch(/\d{4}-\d{2}-\d{2}T|\d{2}:\d{2}:\d{2}/);
  });

  it("C-RCPT-02: generator and design", () => {
    expect(RECEIPT.generator).toEqual({
      name: "dyelot",
      site: ORIGIN,
      engineVersion: "dyelot.engine/1",
    });
    expect(Object.keys(RECEIPT.design)).toEqual([
      "name",
      "specId",
      "lot",
      "link",
      "createdWith",
      "preset",
      "gamut",
      "contrastLevel",
    ]);
    expect(RECEIPT.design).toEqual({
      name: "untitled",
      specId: specId(SPEC),
      lot: lotTag(specId(SPEC)),
      link: `${ORIGIN}/studio#s=${encodeSpec(SPEC)}`,
      createdWith: "controls",
      preset: presetOf(SPEC),
      gamut: SPEC.color.params.gamut,
      contrastLevel: SPEC.color.params.contrastLevel,
    });
    const tide = generateSystem(
      { ...DEFAULT_PARAMS, oneLiner: "Tide tables for small harbors" },
      "seed-1",
    );
    const design = receiptOf(tide).design;
    expect(design.oneLiner).toBe("Tide tables for small harbors");
    expect(Object.keys(design).slice(0, 2)).toEqual(["name", "oneLiner"]);
  });

  it("C-RCPT-03: summary, contrast entries and findings", () => {
    const summary = summarize(measureSpec(SPEC), lintSpec(SPEC), SPEC.color.params.gamut);
    expect(RECEIPT.summary).toEqual(summary);
    expect(Object.keys(RECEIPT.summary)).toEqual(Object.keys(summary));
    const measured = measureSpec(SPEC).contrast;
    expect(RECEIPT.contrast).toHaveLength(80);
    RECEIPT.contrast.forEach((entry: Json, index: number) => {
      const m = measured[index];
      const check = CONTRAST_CHECKS.find((c) => c.id === m?.check);
      const roles = SPEC.color.roles[m?.mode as Mode];
      expect(Object.keys(entry)).toEqual([
        "check",
        "rule",
        "kind",
        "mode",
        "foreground",
        "fg",
        "background",
        "bg",
        "ratio",
        "threshold",
        "required",
        "pass",
        "lc",
      ]);
      expect(entry).toEqual({
        check: check?.id,
        rule: check?.rule,
        kind: check?.kind,
        mode: m?.mode,
        foreground: check?.foreground,
        fg: roles[check?.foreground as never],
        background: check?.background,
        bg: roles[check?.background as never],
        ratio: Number(trunc4(m?.ratio as number)),
        threshold: check?.threshold,
        required: check?.required,
        pass: m?.pass,
        lc: round1(
          perceptualLc(
            hexToRgb(roles[check?.foreground as never]),
            hexToRgb(roles[check?.background as never]),
          ),
        ),
      });
    });
    const findings = lintSpec(SPEC);
    expect(RECEIPT.findings).toHaveLength(findings.length);
    findings.forEach((finding, index) => {
      const written = RECEIPT.findings[index];
      expect(Object.keys(written)).toEqual([
        "id",
        "severity",
        "mode",
        "subject",
        "measured",
        "threshold",
        "source",
      ]);
      expect(written.id).toBe(finding.id);
      const wcag = ["C1", "C2", "C5", "N1", "N2", "N3", "F1"].includes(finding.id);
      expect(written.measured).toBe(Number((wcag ? trunc4 : fmt4)(finding.measured)));
      expect(written.threshold).toBe(Number(fmt4(finding.threshold)));
    });
    // An overlaid C1 finding at 4.49996-ish writes the truncated ratio.
    const miss = nearMiss();
    const spec = overlay(SPEC, "light", { foreground: miss.fg, background: miss.bg });
    const c1 = receiptOf(spec).findings.find(
      (f: Json) => f.id === "C1" && f.subject === "foreground/background" && f.mode === "light",
    );
    const full = wcagRatio(hexToRgb(miss.fg as never), hexToRgb(miss.bg as never));
    expect(c1.measured).toBe(Number(trunc4(full)));
    expect(c1.measured).toBe(4.4999);
  });

  it("C-RCPT-04: pass comes from the full float (property, seed 3008)", () => {
    const hex = fc.oneof(
      fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`),
      fc.integer({ min: 0x60, max: 0xa0 }).map((n) => {
        const h = n.toString(16);
        return `#${h}${h}${h}`;
      }),
    );
    const roles = fc.array(fc.tuple(fc.constantFrom(...ROLE_NAMES), hex), {
      minLength: 1,
      maxLength: 10,
    });
    fc.assert(
      fc.property(roles, roles, (light, dark) => {
        let spec = overlay(SPEC, "light", Object.fromEntries(light));
        spec = overlay(spec, "dark", Object.fromEntries(dark));
        for (const entry of receiptOf(spec).contrast as Json[]) {
          const full = wcagRatio(hexToRgb(entry.fg), hexToRgb(entry.bg));
          expect(entry.pass).toBe(full >= entry.threshold);
          expect(entry.ratio).toBeLessThanOrEqual(full);
          if (entry.ratio === 4.5) expect(full).toBeGreaterThanOrEqual(4.5);
          if (full >= 4.4999 && full < 4.5 && entry.threshold === 4.5) {
            expect(entry.ratio).toBe(4.4999);
            expect(entry.pass).toBe(false);
          }
        }
      }),
      { numRuns: 500, seed: SEED },
    );
  });

  it("C-RCPT-04: a near miss writes 4.4999 and fails", () => {
    const miss = nearMiss();
    const entry = receiptOf(
      overlay(SPEC, "light", { foreground: miss.fg, background: miss.bg }),
    ).contrast.find((e: Json) => e.check === "C1:foreground/background" && e.mode === "light");
    expect(entry.ratio).toBe(4.4999);
    expect(entry.pass).toBe(false);
  });

  it("C-RCPT-05: separation and gamut", () => {
    const m = measureSpec(SPEC);
    expect(RECEIPT.separation).toHaveLength(16);
    m.separation.forEach((s, index) => {
      expect(RECEIPT.separation[index]).toEqual({
        set: s.set,
        mode: s.mode,
        view: s.view,
        minDeltaE: Number(trunc4(s.minDeltaE)),
        threshold: 0.08,
        pass: s.minDeltaE >= 0.08,
      });
      expect(Object.keys(RECEIPT.separation[index])).toEqual([
        "set",
        "mode",
        "view",
        "minDeltaE",
        "threshold",
        "pass",
      ]);
    });
    expect(RECEIPT.gamut).toEqual({ gamut: "srgb", values: 176, outside: [] });
    const primary = SPEC.color.palettes.primary;
    const light = primary.light.map((step) =>
      step.step === 500 ? { ...step, oklch: { l: 0.7, c: 0.37, h: 145 } } : step,
    );
    const spec = {
      ...SPEC,
      color: {
        ...SPEC.color,
        palettes: { ...SPEC.color.palettes, primary: { ...primary, light } },
      },
    } as DesignSpec;
    const excess = measureSpec(spec).gamut.find(
      (g) => g.palette === "primary" && g.step === 500 && g.mode === "light",
    )?.excess as number;
    const g1 = lintSpec(spec).find((f) => f.id === "G1");
    expect(g1?.threshold).toBe(2e-4);
    expect(excess).toBeGreaterThan(g1?.threshold as number);
    const outside = receiptOf(spec).gamut.outside;
    expect(outside).toEqual([
      { palette: "primary", step: 500, mode: "light", excess: Number(fmt4(excess)) },
    ]);
    expect(Object.keys(outside[0])).toEqual(["palette", "step", "mode", "excess"]);
  });

  it("C-RCPT-06: roles and radius", () => {
    for (const mode of ["light", "dark"] as const) {
      expect(Object.keys(RECEIPT.roles[mode])).toEqual([...ROLE_NAMES]);
      expect(RECEIPT.roles[mode]).toEqual(SPEC.color.roles[mode]);
    }
    const css = themeCss(SPEC, ORIGIN);
    const radius = /^ {2}--radius: (.+);$/m.exec(css)?.[1];
    expect(RECEIPT.radius).toBe(radius);
    expect(RECEIPT.radius).toMatch(/px$/);
  });

  it("C-RCPT-07: a failing required check", () => {
    const spec = overlay(SPEC, "light", { "secondary-foreground": "#858585" });
    const receipt = receiptOf(spec);
    expect(receipt.summary.contrast.requiredPass).toBe(77);
    expect(receipt.summary.lint.error).toBe(1);
    expect(receipt.summary.pass).toBe(false);
    const entry = receipt.contrast.find(
      (e: Json) => e.check === "C1:secondary-foreground/secondary" && e.mode === "light",
    );
    expect(entry.pass).toBe(false);
    const errors = receipt.findings.filter((f: Json) => f.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      id: "C1",
      mode: "light",
      subject: "secondary-foreground/secondary",
    });
  });

  it("C-RCPT-08 (stub half): files list the stubs with bytes and sha256", () => {
    expect(STUB_FILES).toHaveLength(20);
    expect(RECEIPT.files).toEqual(
      STUB_FILES.map((file) => ({
        path: file.path,
        bytes: new TextEncoder().encode(file.text).length,
        sha256: sha256(file.text),
      })),
    );
    expect(Object.keys(RECEIPT.files[0])).toEqual(["path", "bytes", "sha256"]);
    expect(RECEIPT.files.map((f: Json) => f.path)).not.toContain("receipt.json");
  });

  it("C-RCPT-09: wrong inputs throw, naming receiptJson", () => {
    const cases: [() => unknown, ErrorConstructor][] = [
      [() => receiptJson(null as never, STUB_FILES, ORIGIN), TypeError],
      [() => receiptJson(SPEC, "x" as never, ORIGIN), TypeError],
      [() => receiptJson(SPEC, STUB_FILES, 3 as never), TypeError],
      [() => receiptJson(SPEC, STUB_FILES, "http://dyelot.vercel.app"), RangeError],
      [() => receiptJson(SPEC, STUB_FILES, "https://dyelot.vercel.app/"), RangeError],
      [
        () => receiptJson(SPEC, [...STUB_FILES, { path: "receipt.json", text: "{}\n" }], ORIGIN),
        RangeError,
      ],
      [() => receiptJson(SPEC, [...STUB_FILES, STUB_FILES[0] as never], ORIGIN), RangeError],
    ];
    for (const [call, type] of cases) {
      expect(call).toThrow(type);
      expect(call).toThrow(/receiptJson/);
    }
  });
});
