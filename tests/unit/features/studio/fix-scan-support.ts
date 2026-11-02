import { expect, it } from "vitest";
import {
  CHROMA_LEVELS,
  type Gamut,
  generateSystem,
  lintSpec,
  NEUTRAL_TINTS,
  SCALE_MODES,
} from "@/engine";
import { DEFAULT_PARAMS, PROPERTY_TIMEOUT } from "../../spec/support";

// C-INSPECT-16 of docs/specs/02-studio.md, section 6.8: the scan behind R2-10. For 3 chroma levels × 4
// neutral tints × 2 gamuts × 2 scale modes × seeds s0 to s11 at AA, `DEFAULT_PARAMS` otherwise, the
// engine raises no C1, C5, N1 or F1 finding, so those findings reach the studio only from a link made
// elsewhere. The 576 designs are split by gamut over two files that run in parallel, in the `scan` project,
// after the other unit projects (vitest.config.ts): about 65 s each.

const FIXABLE: ReadonlySet<string> = new Set(["C1", "C5", "N1", "F1"]);
const SEEDS = Array.from({ length: 12 }, (_, i) => `s${i}`);

/** Registers the scan of the 288 designs of one gamut. */
export function scanGamut(gamut: Gamut): void {
  it(
    `C-INSPECT-16 the engine raises no C1, C5, N1 or F1 finding at AA (${gamut}, 288 designs)`,
    () => {
      let designs = 0;
      const raised: string[] = [];
      for (const chroma of CHROMA_LEVELS) {
        for (const neutralTint of NEUTRAL_TINTS) {
          for (const scaleMode of SCALE_MODES) {
            for (const seed of SEEDS) {
              const params = {
                ...DEFAULT_PARAMS,
                chroma,
                neutralTint,
                gamut,
                scaleMode,
                contrastLevel: "AA",
              } as const;
              designs++;
              for (const item of lintSpec(generateSystem(params, seed))) {
                if (FIXABLE.has(item.id)) {
                  raised.push(
                    `${chroma} ${neutralTint} ${scaleMode} ${seed}: ${item.id} ${item.subject}`,
                  );
                }
              }
            }
          }
        }
      }
      expect([CHROMA_LEVELS.length, NEUTRAL_TINTS.length, SCALE_MODES.length]).toEqual([3, 4, 2]);
      expect(designs).toBe(288);
      expect(raised).toEqual([]);
    },
    PROPERTY_TIMEOUT,
  );
}
