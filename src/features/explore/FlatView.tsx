import type { Mode } from "@/engine";
import { gamutSlice, SOLID_GAMUTS, type SolidGamut } from "@/engine";
import type { DesignSpec } from "@/spec";
import { dotAt, GAMUT_NAMES, scenePoints, slicePath, sliceSteps } from "./scene";

const SIZE = 320;
const LIST_ID = "flat-view-steps";

/** Each outline's line (8.3): the chrome stays achromatic, so a dye color is judged against it. */
const LINES: Readonly<Record<SolidGamut, { stroke: string; dash?: string; dotted?: true }>> = {
  srgb: { stroke: "var(--foreground)" },
  p3: { stroke: "var(--fg-muted)", dash: "6 4" },
  rec2020: { stroke: "var(--border-bright)", dash: "1 4", dotted: true },
};

const LEGEND: Readonly<Record<SolidGamut, string>> = {
  srgb: "solid line",
  p3: "dashed line",
  rec2020: "dotted line",
};

/**
 * The explorer's flat view (R5-37, 8.3): one lightness slice drawn in polar form, the accessible
 * form of the 3D view and its fallback. It renders on the server and in the client.
 */
export function FlatView({ spec, mode, l }: { spec: DesignSpec; mode: Mode; l: number }) {
  const near = sliceSteps(scenePoints(spec, mode), l);
  const at = l.toFixed(2);
  return (
    <figure data-flat-view className="m-0 min-w-0 space-y-3">
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: the figcaption names the figure, by aria-labelledby (R5-37) */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby="flat-view-caption"
        className="h-auto max-w-full rounded-lg border border-border bg-panel"
      >
        {SOLID_GAMUTS.map((gamut) => {
          const line = LINES[gamut];
          return (
            <path
              key={gamut}
              data-outline={gamut}
              d={slicePath(gamutSlice(gamut, l), SIZE)}
              fill="none"
              stroke={line.stroke}
              strokeWidth={1.5}
              strokeDasharray={line.dash}
              strokeLinecap={line.dotted ? "round" : undefined}
            />
          );
        })}
        {near.map((point) => {
          const [cx, cy] = dotAt(point.oklch, SIZE);
          return (
            <circle
              key={`${point.palette}-${point.step}`}
              data-dot={`${point.palette}-${point.step}`}
              cx={cx}
              cy={cy}
              r={4}
              fill={point.hex}
            />
          );
        })}
      </svg>
      <figcaption id="flat-view-caption" className="font-mono text-xs text-fg-muted">
        {`At L ${at}: how far each gamut reaches at every hue, and the ${near.length} steps within 0.04 of that lightness.`}
      </figcaption>
      <ul className="m-0 list-none space-y-1 p-0 font-mono text-xs text-fg-muted">
        {SOLID_GAMUTS.map((gamut) => (
          <li key={gamut}>{`${GAMUT_NAMES[gamut]}: ${LEGEND[gamut]}`}</li>
        ))}
      </ul>
      <p id={LIST_ID} className="m-0 font-mono text-xs text-foreground">
        Steps near this lightness
      </p>
      <ul
        aria-labelledby={LIST_ID}
        className="m-0 list-none space-y-1 p-0 font-mono text-xs text-fg-muted"
      >
        {near.length === 0 ? (
          <li>{`No step lies within 0.04 of L ${at}.`}</li>
        ) : (
          near.map((point) => {
            const { l: lightness, c, h } = point.oklch;
            const hue = h === null ? "none" : String(Math.round(h));
            return (
              <li key={`${point.palette}-${point.step}`}>
                {`${point.palette} ${point.step} · ${point.hex} · L ${lightness.toFixed(2)} · C ${c.toFixed(3)} · H ${hue}`}
              </li>
            );
          })
        )}
      </ul>
    </figure>
  );
}
