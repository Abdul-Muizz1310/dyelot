import { Moon, Sun } from "lucide-react";
import { memo } from "react";
import type { Hex } from "@/engine";
import type { ModeCell, RoleRow } from "./inspect";
import { PanelSection } from "./PanelSection";

// The Roles section of the inspector (spec section 7.8): the 32 pairs of `roleRows`, each a group of
// three lines so every value fits a 320 px drawer without a sideways scroller: the pair and its kind,
// then a light line and a dark line with the two hexes beside their swatches, the WCAG ratio, the pass
// level and the signed advisory score. The level is text, and a fail also carries ✕. The column
// header stays at the top of the scroll area while the rows pass under it. At 11 px Geist Mono a
// character is 7 px wide, so the columns are cut to the widest value plus a gap: an 8-character level
// with its 6 px lead, a 5-character ratio, and two auto columns of a swatch and a 7-character hex that
// share the rest (64 px each in the 287 px table of a 320 px drawer). The scores take at most four
// characters, so "advisory" hangs left over the level column's free space instead of widening its own.

const MODES = ["light", "dark"] as const;

export const RoleTable = memo(function RoleTable({ rows }: { rows: readonly RoleRow[] }) {
  return (
    <PanelSection
      title="Roles"
      note="WCAG 2.2 ratio and level for each pair in light and dark. Lc is the advisory perceptual score: plus for dark on light, minus for light on dark."
    >
      <table className="w-full table-fixed border-collapse font-mono text-[11px] tabular-nums leading-[1.125rem]">
        <caption className="sr-only">The 32 role pairs, in light and dark mode</caption>
        <colgroup>
          <col className="w-4" />
          <col />
          <col />
          <col className="w-[2.375rem]" />
          <col className="w-[3.875rem]" />
          <col className="w-[2.6875rem]" />
        </colgroup>
        <thead>
          <tr className="text-left text-[11px] text-fg-muted *:sticky *:-top-4 *:z-10 *:bg-panel *:shadow-[inset_0_-1px_0_var(--border)]">
            <th scope="col" className="pb-1 font-normal">
              <span className="sr-only">Mode</span>
            </th>
            <th scope="col" className="pb-1 font-normal">
              color
            </th>
            <th scope="col" className="pb-1 font-normal">
              on
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              ratio
            </th>
            <th scope="col" className="pb-1 pl-1.5 font-normal">
              level
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              <abbr title="Lc, the advisory perceptual score" className="-ml-4 no-underline">
                advisory
              </abbr>
            </th>
          </tr>
        </thead>
        {rows.map((row) => (
          <tbody
            key={row.pair}
            data-pair={row.pair}
            data-kind={row.kind}
            className="border-border border-t"
          >
            <tr>
              <th
                scope="rowgroup"
                colSpan={6}
                className="pt-1.5 text-left font-normal font-sans text-[11px] leading-4"
              >
                <span translate="no" className="break-words text-foreground">
                  {row.foreground} / {row.fill}
                </span>{" "}
                <span className="text-fg-muted">{row.kind === "text" ? "text" : "non-text"}</span>
              </th>
            </tr>
            {MODES.map((mode) => (
              <ModeLine key={mode} mode={mode} cell={row[mode]} />
            ))}
          </tbody>
        ))}
      </table>
    </PanelSection>
  );
});

function ModeLine({ mode, cell }: { mode: (typeof MODES)[number]; cell: ModeCell }) {
  const Icon = mode === "light" ? Sun : Moon;
  return (
    <tr data-mode={mode} className="last:*:pb-1.5">
      <th scope="row" className="font-normal text-fg-muted">
        <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
        <span className="sr-only">{mode}</span>
      </th>
      <td>
        <HexCell hex={cell.foreground} name="foreground" />
      </td>
      <td>
        <HexCell hex={cell.fill} name="fill" />
      </td>
      <td data-ratio="" className="text-right text-foreground">
        {cell.ratio.toFixed(2)}
      </td>
      <td data-level="" className="pl-1.5 whitespace-nowrap text-foreground">
        {cell.level === "fail" ? (
          <>
            <span aria-hidden="true">✕ </span>
            <span className="font-semibold">fail</span>
          </>
        ) : (
          cell.level
        )}
      </td>
      <td data-lc="" className="text-right text-fg-muted">
        {cell.lcText}
      </td>
    </tr>
  );
}

function HexCell({ hex, name }: { hex: Hex; name: "foreground" | "fill" }) {
  return (
    <span className="flex min-w-0 items-center gap-[3px]">
      <span
        data-swatch=""
        aria-hidden="true"
        className="size-2 shrink-0 rounded-[2px] shadow-[0_0_0_1px_var(--border-bright)]"
        style={{ backgroundColor: hex }}
      />
      <span data-hex={name} translate="no" className="truncate text-foreground">
        {hex}
      </span>
    </span>
  );
}
