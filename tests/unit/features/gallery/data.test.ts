import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as AI from "@/ai";
import {
  FONT_CATALOG,
  generateSystem,
  lintSpec,
  measureSpec,
  oklchToRgb,
  PRESETS,
  paramsOfSpec,
  resolveParams,
  summarize,
  toHex,
} from "@/engine";
import { dtcgFiles } from "@/export/dtcg";
import { exportState } from "@/features/export/files";
import { type GalleryAi, galleryData, galleryEntry } from "@/features/gallery/build";
import {
  entriesTagged,
  entryDescription,
  entryMetadata,
  entryOf,
  GALLERY,
  type GalleryData,
  type GalleryEntry,
  galleryRoutes,
} from "@/features/gallery/data";
import { HERO_CARDS } from "@/features/landing/cards";
import { HERO_PARAMS, heroSpec } from "@/features/landing/heroes";
import { STORY_ROLES } from "@/features/landing/story";
import { decodeSpec, lotTag, specId } from "@/spec";
import { SPEC } from "../../export/golden-support";
import { PROPERTY_TIMEOUT } from "../../spec/support";
import { BRIEFS, DEFS, ENTRY, HEROES, SPEC_OF } from "../../support/gallery";

// C-GAL6-02, 04 to 07, 11 to 13 and RF2 of docs/specs/06-gallery.md, section 14.1 (R6-04, R6-08,
// R6-10). `DYELOT_UPDATE_GALLERY=1` rewrites src/features/gallery/gallery.json, as R3-11 writes JSON;
// it fails together with `CI`.

const FILE = path.join(process.cwd(), "src/features/gallery/gallery.json");
const UPDATE_HINT = "run the update with DYELOT_UPDATE_GALLERY=1";

/** Why `actual` is not `expected`: the first slug whose entry differs, or null for equal data. */
function galleryDrift(expected: GalleryData, actual: GalleryData): string | null {
  const wire = (data: GalleryData) => JSON.parse(JSON.stringify(data)) as GalleryData;
  const want = wire(expected).entries;
  const got = wire(actual).entries;
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    const a = want[i];
    const b = got[i];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      return `gallery.json differs from galleryData at "${(a ?? b)?.slug}": ${UPDATE_HINT}`;
    }
  }
  return null;
}

let rebuilt: GalleryData | null = null;
/** `galleryData(AI)`, built once per test file. */
const built = (): GalleryData => {
  rebuilt ??= galleryData(AI);
  return rebuilt;
};

if (process.env.DYELOT_UPDATE_GALLERY === "1") {
  describe("the committed gallery", () => {
    it(
      "C-GAL6-02 rewrites gallery.json, and never in CI",
      () => {
        expect(process.env.CI, "DYELOT_UPDATE_GALLERY must not run in CI").toBeUndefined();
        writeFileSync(FILE, `${JSON.stringify(built(), null, 2)}\n`);
      },
      PROPERTY_TIMEOUT,
    );
  });
}

describe("GALLERY, the committed data (R6-04)", () => {
  it(
    "C-GAL6-02 deep-equals galleryData(AI)",
    () => {
      expect(galleryDrift(built(), GALLERY)).toBeNull();
      expect(GALLERY).toEqual(JSON.parse(JSON.stringify(built())));
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-GAL6-RF2 names the first drifted entry and the update switch",
    () => {
      const target = BRIEFS[3];
      if (target === undefined || target.source !== "brief") throw new Error("no row");
      const other = AI.matchLexicon("A neon synthwave arcade, holographic and playful.");
      const drifted: GalleryAi = {
        ...AI,
        matchLexicon: (text: string) =>
          text.includes(target.brief.slice(0, 20)) ? other : AI.matchLexicon(text),
      };
      const message = galleryDrift(galleryData(drifted), GALLERY);
      expect(message).not.toBeNull();
      expect(message).toContain(target.slug);
      expect(message).toContain(UPDATE_HINT);
      expect(galleryDrift(GALLERY, GALLERY)).toBeNull();
      expect(galleryDrift({ entries: [] }, GALLERY)).toContain("madder");
    },
    PROPERTY_TIMEOUT,
  );
});

const HEX = /^#[0-9a-f]{6}$/;

describe("every entry (R6-08, R6-10)", () => {
  it(
    "C-GAL6-04 passes every required check with no lint error, as summarize gives it",
    () => {
      expect(GALLERY.entries).toHaveLength(24);
      for (const entry of GALLERY.entries) {
        const spec = SPEC_OF(entry.slug);
        expect(entry.summary.pass, entry.slug).toBe(true);
        expect(entry.summary.contrast.requiredPass, entry.slug).toBe(
          entry.summary.contrast.required,
        );
        expect(entry.summary.contrast.required).toBe(78);
        expect(entry.summary.lint.error).toBe(0);
        expect(entry.summary).toEqual(
          summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut),
        );
      }
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-GAL6-05 rebuilds from its own parameters to the same spec id, and exports",
    () => {
      for (const entry of GALLERY.entries) {
        const spec = decodeSpec(entry.link);
        const { seed, createdWith } = spec.meta;
        const again = generateSystem(resolveParams(paramsOfSpec(spec).params, seed), seed, {
          createdWith,
        });
        expect(specId(again), entry.slug).toBe(specId(spec));
        expect(lintSpec(spec).filter((finding) => finding.severity === "error")).toEqual([]);
        expect(exportState(entry.summary, "loaded"), entry.slug).toBe("passing");
      }
    },
    PROPERTY_TIMEOUT,
  );

  it("C-GAL6-06 holds the six heroes as M5 committed them", () => {
    HEROES.forEach((def, i) => {
      const entry = ENTRY(def.slug);
      const hex = HERO_CARDS.cards[i]?.href.slice("/studio#s=".length);
      expect(entry.link).toBe(hex);
      expect(entry.specId).toBe(specId(heroSpec(i)));
      expect(entry.createdWith).toBe("controls");
      expect(entry.preset).toBeNull();
      expect(entry.presetLabel).toBe("Custom");
      expect(entry.source).toBe("hero");
      expect(entry.brief).toBeNull();
      expect(entry.terms).toEqual([]);
      const primary = HERO_PARAMS[i]?.primary;
      if (primary === undefined) throw new Error("no hero");
      expect(toHex(oklchToRgb(primary, "srgb"))).toBe(HERO_HEX[i]);
      expect(entry.line).toBe(`One locked seed, ${HERO_HEX[i]}, and the studio's defaults.`);
    });
  });

  it(
    "C-GAL6-07 holds each field as the spec gives it",
    () => {
      for (const entry of GALLERY.entries) {
        const spec = decodeSpec(entry.link);
        expect(entry.specId, entry.slug).toBe(specId(spec));
        expect(entry.lot).toBe(lotTag(entry.specId));
        expect(entry.createdWith).toBe(spec.meta.createdWith);
        expect(entry.presetLabel).toBe(
          entry.preset === null ? "Custom" : PRESETS[entry.preset].label,
        );
        const family = (id: string) => FONT_CATALOG.find((font) => font.id === id)?.family;
        expect(entry.families).toEqual({
          display: family(spec.type.families.display),
          body: family(spec.type.families.body),
          mono: family(spec.type.families.mono),
        });
        const palettes = ["primary", "secondary", "accent", "neutral", "danger"] as const;
        expect(entry.specimen.map((row) => row.palette)).toEqual([...palettes]);
        entry.specimen.forEach((row) => {
          const scale = spec.color.palettes[row.palette].light;
          const at = (step: number) => scale.find((s) => s.step === step)?.hex;
          expect(row.hexes).toEqual([100, 300, 500, 700, 900].map(at));
        });
        for (const mode of ["light", "dark"] as const) {
          for (const [name, scale] of Object.entries(spec.color.palettes)) {
            const hexes = entry.scales[mode][name as keyof typeof spec.color.palettes];
            expect(hexes, `${entry.slug} ${mode} ${name}`).toEqual(scale[mode].map((s) => s.hex));
            expect(hexes).toHaveLength(11);
          }
          expect(Object.keys(entry.scales[mode])).toHaveLength(8);
          expect(entry.roles[mode]).toEqual(
            STORY_ROLES.map((name) => ({ name, hex: spec.color.roles[mode][name] })),
          );
        }
        expect(entry.type.map((step) => step.name)).toEqual(spec.type.steps.map((s) => s.name));
        expect(entry.type).toHaveLength(10);
        entry.type.forEach((step, i) => {
          const source = spec.type.steps[i];
          expect(step.sizePx).toBe(source?.sizePx);
          expect(step.lineHeightPx).toBe(source?.lineHeightPx);
          expect(step.family).toBe(
            ["display", "h1", "h2", "h3", "h4"].includes(step.name) ? "display" : "body",
          );
        });
        const hexes = [
          ...entry.specimen.flatMap((row) => row.hexes),
          ...Object.values(entry.scales).flatMap((mode) => Object.values(mode).flat()),
          ...Object.values(entry.roles).flatMap((roles) => roles.map((role) => role.hex)),
        ];
        expect(hexes.every((hex) => HEX.test(hex))).toBe(true);
      }
    },
    PROPERTY_TIMEOUT,
  );

  it("C-GAL6-07 agrees with the DTCG export on which family each type step takes", () => {
    for (const slug of ["madder", "kermes", "turquoise"]) {
      const entry = ENTRY(slug);
      const files = dtcgFiles(SPEC_OF(slug), entry.name, "https://dyelot.vercel.app");
      const base = JSON.parse(
        files.find((file) => file.path === "tokens/base.tokens.json")?.text ?? "{}",
      );
      for (const step of entry.type) {
        const token = base.type[step.name].$value;
        expect(token.fontFamily, `${slug} ${step.name}`).toEqual(base.font[step.family].$value);
      }
    }
  });
});

const HERO_HEX = ["#f66c6d", "#e3c23b", "#4bae87", "#0e84b7", "#7652ac", "#cd3f9b"] as const;

describe("entryDescription and entryMetadata (R6-17)", () => {
  it("C-GAL6-11 writes the line and the passing counts, in 50 to 160 characters", () => {
    for (const entry of GALLERY.entries) {
      const { requiredPass, required } = entry.summary.contrast;
      const text = entryDescription(entry);
      expect(text).toBe(
        `${entry.line} ${requiredPass} of ${required} required contrast checks pass.`,
      );
      expect(text.length).toBeGreaterThanOrEqual(50);
      expect(text.length).toBeLessThanOrEqual(160);
      expect(entryMetadata(entry)).toEqual({
        title: entry.name,
        description: text,
        alternates: { canonical: `/gallery/${entry.slug}` },
      });
    }
  });
});

describe("the data's errors (R6-08, R-05)", () => {
  it("C-GAL6-12 refuses a wrong type and gives null for an unknown slug", () => {
    for (const call of [() => entryOf(3 as never), () => entriesTagged(5 as never)]) {
      expect(call).toThrow(TypeError);
    }
    expect(() => entryOf(3 as never)).toThrow(/^entryOf/);
    expect(() => entriesTagged(5 as never)).toThrow(/^entriesTagged/);
    expect(() => entriesTagged("loud" as never)).toThrow(RangeError);
    expect(() => entriesTagged("loud" as never)).toThrow(/^entriesTagged/);
    for (const slug of ["Madder", "nope", ""]) expect(entryOf(slug)).toBeNull();
    expect(entryOf("madder")).toEqual(ENTRY("madder"));
  });

  it("C-GAL6-12 galleryEntry refuses a null spec and a bad slug", () => {
    expect(() => galleryEntry(null as never, DEFS[0] as never, [])).toThrow(TypeError);
    expect(() => galleryEntry(null as never, DEFS[0] as never, [])).toThrow(/^galleryEntry/);
    const bad = { ...DEFS[6], slug: "Bad Slug" } as never;
    expect(() => galleryEntry(SPEC, bad, [])).toThrow(RangeError);
    expect(() => galleryEntry(SPEC, bad, [])).toThrow(/^galleryEntry/);
    expect(() => galleryEntry(SPEC, null as never, [])).toThrow(/^galleryEntry/);
    expect(() => galleryEntry({ ...SPEC, color: 1 } as never, DEFS[6] as never, [])).toThrow(
      /^galleryEntry/,
    );
  });

  it("C-GAL6-12 galleryEntry refuses steps that are no array and a hero that does not exist", () => {
    const noSteps = { ...SPEC, type: { ...SPEC.type, steps: 1 } } as never;
    expect(() => galleryEntry(noSteps, DEFS[6] as never, [])).toThrow(TypeError);
    expect(() => galleryEntry(noSteps, DEFS[6] as never, [])).toThrow(/^galleryEntry/);
    const ghost = { slug: "ghost", source: "hero", hero: 9, tags: ["calm"] } as never;
    expect(() => galleryEntry(SPEC, ghost, [])).toThrow(RangeError);
    expect(() => galleryEntry(SPEC, ghost, [])).toThrow(/^galleryEntry/);
  });

  it("C-GAL6-12 galleryEntry names a family outside the catalog by its id", () => {
    const odd = {
      ...SPEC,
      type: { ...SPEC.type, families: { ...SPEC.type.families, display: "not-in-catalog" } },
    };
    expect(galleryEntry(odd, DEFS[6] as never, []).families.display).toBe("not-in-catalog");
  });

  it("C-GAL6-12 entryDescription refuses a null entry and text out of bounds", () => {
    expect(() => entryDescription(null as never)).toThrow(TypeError);
    expect(() => entryDescription(null as never)).toThrow(/^entryDescription/);
    const entry = ENTRY("madder");
    const long: GalleryEntry = { ...entry, line: "x".repeat(121) };
    expect(() => entryDescription(long)).toThrow(RangeError);
    expect(() => entryDescription(long)).toThrow(/^entryDescription/);
    expect(entryDescription({ ...entry, line: "x".repeat(120) })).toHaveLength(160);
    expect(() => entryDescription({ ...entry, line: "x" })).toThrow(RangeError);
    expect(() => entryMetadata(null as never)).toThrow(/^entryMetadata/);
    expect(() => entryMetadata(long)).toThrow(/^entryMetadata/);
  });
});

describe("the tag filter and the routes (R6-07, R6-31)", () => {
  it("C-GAL6-13 gives every entry for all and unknown, the seven calm ones for calm", () => {
    const slugs = DEFS.map((def) => def.slug);
    expect(entriesTagged("all").map((e) => e.slug)).toEqual(slugs);
    expect(entriesTagged("unknown").map((e) => e.slug)).toEqual(slugs);
    expect(entriesTagged("calm").map((e) => e.slug)).toEqual([
      "verdigris",
      "woad",
      "kermes",
      "smalt",
      "verditer",
      "turmeric",
      "terre-verte",
    ]);
    expect(galleryRoutes()).toEqual(slugs.map((slug) => `/gallery/${slug}`));
    expect(galleryRoutes()).toHaveLength(24);
  });
});
