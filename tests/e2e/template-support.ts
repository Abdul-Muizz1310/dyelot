import { expect, type Locator, type Page } from "@playwright/test";
import { ROLE_NAMES } from "@/engine";
import type { TemplateId } from "@/features/studio/view";
import { canvasFrame } from "./studio-support";

// Shared helpers for the template flows of docs/specs/02-studio.md, sections 7.5 to 7.7: the
// template and frame switches, and the structural checks every template runs (F-TPL-13, F-TPL-15,
// F-TPL-16, F-TPL-38 and F-TPL-39). Tasks 2.9 and 2.10 reuse them for the dashboard, settings and
// mobile templates.

/** The type steps, smallest first. */
export const TYPE_STEPS = [
  "caption",
  "label",
  "body-sm",
  "body",
  "lead",
  "h4",
  "h3",
  "h2",
  "h1",
  "display",
] as const;

const toolbar = (page: Page) => page.getByRole("region", { name: "Canvas toolbar" });

/** Shows a template and waits for its root, and for its entrance, if any, to come to rest. */
export async function showTemplate(page: Page, id: TemplateId): Promise<Locator> {
  await toolbar(page).getByRole("combobox", { name: "Template", exact: true }).selectOption(id);
  const root = templateRoot(page, id);
  await expect(root).toBeVisible();
  await expect
    .poll(() =>
      canvasFrame(page).evaluate((frame) => {
        const entrance = frame.querySelector("[data-entrance]");
        if (entrance === null) return "none";
        const style = getComputedStyle(entrance);
        return `${style.opacity} ${style.transform}`;
      }),
    )
    .toMatch(/^(none|1 none)$/);
  return root;
}

/** The root of the template on the canvas (`data-template-root`). */
export const templateRoot = (page: Page, id: TemplateId): Locator =>
  canvasFrame(page).locator(`[data-template-root="${id}"]`);

/** Sets the canvas frame to 360, 768 or 1280 px and waits for it. */
export async function setFrame(page: Page, frame: 360 | 768 | 1280): Promise<void> {
  await toolbar(page)
    .getByRole("group", { name: "Frame", exact: true })
    .getByRole("radio", { name: String(frame), exact: true })
    .check();
  await expect(canvasFrame(page)).toHaveAttribute("data-frame", String(frame));
}

/**
 * F-TPL-13: every element in `scope` that has three or more children of equal size (layout widths
 * and heights within 1 px) that each hold an icon (an `svg`). Equal icon cards as page structure are
 * on the anti-slop list (research D4); the dashboard's KPI row runs the same check (Task 2.9).
 *
 * Run it on one block (the landing's features block, the dashboard's KPI row), never on a template
 * root: a check list or a closed accordion holds equal rows with an icon each, and that is not a
 * card grid.
 */
export function equalIconSiblings(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const hits: string[] = [];
    for (const parent of [root, ...root.querySelectorAll("*")]) {
      const holders = [...parent.children].filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          child.offsetWidth > 0 &&
          child.querySelector("svg") !== null,
      );
      for (const child of holders) {
        const equal = holders.filter(
          (other) =>
            Math.abs(other.offsetWidth - child.offsetWidth) <= 1 &&
            Math.abs(other.offsetHeight - child.offsetHeight) <= 1,
        );
        if (equal.length >= 3) {
          hits.push(
            `${parent.tagName.toLowerCase()}.${[...parent.classList].join(".")}: ${equal.length} icon children of ${child.offsetWidth}×${child.offsetHeight}`,
          );
          break;
        }
      }
    }
    return hits;
  });
}

/**
 * F-TPL-15: the text nodes on screen in `scope` that hold an emoji or another pictograph, and the
 * SVGs that are neither a lucide icon drawn at `--icon-stroke` nor a named drawn figure.
 */
export function pictographs(scope: Locator): Promise<{ texts: string[]; svgs: string[] }> {
  return scope.evaluate((root) => {
    const texts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (/\p{Extended_Pictographic}/u.test(text)) texts.push(text.trim().slice(0, 40));
    }
    const probe = document.createElement("span");
    probe.style.width = "calc(var(--icon-stroke) * 1px)";
    probe.style.position = "absolute";
    root.append(probe);
    const stroke = `${Number.parseFloat(getComputedStyle(probe).width)}px`;
    probe.remove();
    const svgs: string[] = [];
    for (const svg of root.querySelectorAll("svg")) {
      if (svg.classList.contains("lucide")) {
        const width = getComputedStyle(svg).strokeWidth;
        if (width !== stroke) svgs.push(`lucide at ${width}, not ${stroke}`);
        continue;
      }
      const figure =
        svg.hasAttribute("data-figure") &&
        svg.getAttribute("role") === "img" &&
        (svg.getAttribute("aria-label") ?? "").trim() !== "";
      if (!figure) svgs.push(`${svg.outerHTML.slice(0, 60)} is neither lucide nor a named figure`);
    }
    return { texts, svgs };
  });
}

/**
 * F-TPL-16: the anti-slop structures of `scope`: a logo row (three or more children that each hold
 * only an image and no text), the text "trusted by", and whether the word "sample" shows on screen.
 */
export function slop(
  scope: Locator,
): Promise<{ logoRows: string[]; trusted: boolean; sample: boolean }> {
  return scope.evaluate((root) => {
    const imageOnly = (element: Element) => {
      if ((element.textContent ?? "").trim() !== "") return false;
      const isImage = (node: Element) =>
        node.tagName === "IMG" ||
        (node.tagName.toLowerCase() === "svg" && !node.classList.contains("lucide")) ||
        node.getAttribute("role") === "img";
      return isImage(element) || [...element.querySelectorAll("*")].some(isImage);
    };
    const logoRows: string[] = [];
    for (const parent of [root, ...root.querySelectorAll("*")]) {
      const images = [...parent.children].filter(imageOnly);
      if (images.length >= 3) {
        logoRows.push(`${parent.tagName.toLowerCase()}.${[...parent.classList].join(".")}`);
      }
    }
    // biome-ignore lint/performance/useDomNodeTextContent: the case asks what shows on screen, which only innerText reads.
    const text = (root as HTMLElement).innerText;
    return { logoRows, trusted: /trusted by/i.test(text), sample: /\bsample\b/i.test(text) };
  });
}

/**
 * F-TPL-38: the elements on screen in `scope` with their own text whose font size, leading and
 * tracking are not one type step's triple, and the step classes that do not set their triple. The
 * oracle is a probe set from each step's three variables in the same scope.
 */
export function typeTriples(
  scope: Locator,
): Promise<{ checked: number; classes: string[]; off: string[] }> {
  return scope.evaluate((root, steps) => {
    const triple = (element: Element) => {
      const style = getComputedStyle(element);
      return `${style.fontSize} ${style.lineHeight} ${style.letterSpacing}`;
    };
    const oracle = new Map<string, string>();
    const classes: string[] = [];
    for (const step of steps) {
      const byVars = document.createElement("span");
      byVars.style.fontSize = `var(--text-${step})`;
      byVars.style.lineHeight = `var(--leading-${step})`;
      byVars.style.letterSpacing = `var(--tracking-${step})`;
      const byClass = document.createElement("span");
      byClass.className = `kit-t-${step}`;
      root.append(byVars, byClass);
      oracle.set(triple(byVars), step);
      if (triple(byClass) !== triple(byVars)) classes.push(step);
      byVars.remove();
      byClass.remove();
    }
    const off = new Map<string, number>();
    let checked = 0;
    for (const element of root.querySelectorAll("*")) {
      if (element.closest("[inert]") !== null) continue;
      if (element.getBoundingClientRect().width === 0) continue;
      const text = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
      );
      if (!text) continue;
      checked++;
      if (oracle.has(triple(element))) continue;
      const name = `${element.tagName.toLowerCase()}.${[...element.classList].join(".")} ${triple(element)}`;
      off.set(name, (off.get(name) ?? 0) + 1);
    }
    return { checked, classes, off: [...off].map(([name, count]) => `${name} ×${count}`) };
  }, TYPE_STEPS);
}

/**
 * F-TPL-39: every color painted in `scope` that no role named in the nearest `data-roles` (on the
 * element or its nearest ancestor that has one) computes to: the text color of an element with its
 * own text, an opaque background, a drawn border and an SVG fill or stroke. Text in the display face
 * must name `font-display` there when the display and body faces differ.
 */
export function unnamedPaint(scope: Locator): Promise<{ checked: number; unnamed: string[] }> {
  return scope.evaluate((root, roles) => {
    const probe = document.createElement("span");
    root.append(probe);
    const colorOf = new Map<string, string>();
    for (const role of roles) {
      probe.style.color = `var(--${role})`;
      colorOf.set(role, getComputedStyle(probe).color);
    }
    probe.style.color = "";
    probe.style.fontFamily = "var(--font-display)";
    const display = getComputedStyle(probe).fontFamily;
    probe.style.fontFamily = "var(--font-body)";
    const body = getComputedStyle(probe).fontFamily;
    probe.remove();
    const unnamed = new Map<string, number>();
    let checked = 0;
    for (const element of [root, ...root.querySelectorAll("*")]) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const owner = element.closest("[data-roles]");
      const named = (owner?.getAttribute("data-roles") ?? "").split(/\s+/).filter(Boolean);
      const allowed = new Set(named.map((role) => colorOf.get(role)));
      const style = getComputedStyle(element);
      const text = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
      );
      const paints: [string, string][] = [["background", style.backgroundColor]];
      if (text) paints.push(["color", style.color]);
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        const drawn =
          Number.parseFloat(style[`border${side}Width`]) > 0 &&
          !["none", "hidden"].includes(style[`border${side}Style`]);
        if (drawn) paints.push([`border-${side.toLowerCase()}`, style[`border${side}Color`]]);
      }
      if (element instanceof SVGElement) {
        paints.push(["fill", style.fill], ["stroke", style.stroke]);
      }
      const label = `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`;
      for (const [property, value] of paints) {
        // Opaque sRGB colors only: transparent, a mix with transparency and `none` paint nothing to name.
        if (!value.startsWith("rgb(")) continue;
        checked++;
        if (allowed.has(value)) continue;
        const name = `${label} ${property} ${value} (roles: ${named.join(" ") || "none"})`;
        unnamed.set(name, (unnamed.get(name) ?? 0) + 1);
      }
      if (
        text &&
        display !== body &&
        style.fontFamily === display &&
        !named.includes("font-display")
      ) {
        const name = `${label} display face without font-display (roles: ${named.join(" ") || "none"})`;
        unnamed.set(name, (unnamed.get(name) ?? 0) + 1);
      }
    }
    return { checked, unnamed: [...unnamed].map(([name, count]) => `${name} ×${count}`) };
  }, ROLE_NAMES);
}

/**
 * F-TPL-09, F-TPL-10: whether anything in the frame overflows it: the frame's own scroll width,
 * and every element of `scope` whose box ends past the frame's right edge (layout px).
 */
export function overflow(
  scope: Locator,
): Promise<{ scroll: number; client: number; past: string[] }> {
  return scope.evaluate((root) => {
    const frame = root.closest<HTMLElement>("[data-canvas][data-frame]");
    if (frame === null) throw new Error("overflow: no frame");
    const box = frame.getBoundingClientRect();
    const scale = box.width / frame.offsetWidth;
    const past: string[] = [];
    for (const element of root.querySelectorAll("*")) {
      const edge = element.getBoundingClientRect();
      if (edge.width === 0) continue;
      if ((edge.right - box.right) / scale > 0.5) {
        past.push(`${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`);
      }
    }
    return { scroll: frame.scrollWidth, client: frame.clientWidth, past: past.slice(0, 10) };
  });
}

/** The computed color of a role inside `scope`, as the browser writes it. */
export function roleColor(scope: Locator, role: string): Promise<string> {
  return scope.evaluate((element, name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--${name})`;
    element.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, role);
}

/**
 * F-TPL-16: the hero-metric blocks of `hero`, the landing's `data-block="hero"`: each element whose own
 * text is a figure set at the `h2` step or larger (section 7.6).
 */
export function heroMetrics(hero: Locator): Promise<string[]> {
  return hero.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.fontSize = "var(--text-h2)";
    element.append(probe);
    const h2 = Number.parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    const figure = /^[$€£¥]?\s*[+−-]?\d[\d,.:\s]*(%|\s?[A-Za-z]{1,3})?$/;
    return [element, ...element.querySelectorAll("*")]
      .filter((node) => {
        const own = [...node.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent ?? "")
          .join("")
          .trim();
        return figure.test(own) && Number.parseFloat(getComputedStyle(node).fontSize) >= h2 - 0.01;
      })
      .map((node) => node.textContent ?? "");
  });
}

/**
 * F-CANVAS-09, F-TPL-40: the figures (`.kit-num`) on screen in `scope`, each as its text and the
 * number of lines it takes ("4.1 m 1").
 */
export function figureLines(scope: Locator): Promise<string[]> {
  return scope.evaluate((element) =>
    [...element.querySelectorAll(".kit-num")]
      .filter((figure) => figure.getBoundingClientRect().width > 0)
      .map((figure) => {
        const range = document.createRange();
        range.selectNodeContents(figure);
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        return `${figure.textContent} ${tops.size}`;
      }),
  );
}

/**
 * F-CANVAS-09, F-TPL-40: the words of 20 characters or fewer (a hyphen ends a word) on screen in
 * `scope` that take more than one client rect, and how many words were measured. Only a longer word,
 * such as the 40-character word of R2-21, may break inside itself.
 */
export function brokenWords(scope: Locator): Promise<{ checked: number; broken: string[] }> {
  return scope.evaluate((element) => {
    const broken: string[] = [];
    let checked = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.parentElement?.getBoundingClientRect().width ?? 0) === 0) continue;
      const text = node.textContent ?? "";
      for (const match of text.matchAll(/[^\s-]+-?/g)) {
        if (match[0].length > 20) continue;
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
        checked++;
        if (rects.length > 1) broken.push(`${match[0]} in ${rects.length} pieces`);
      }
    }
    return { checked, broken };
  });
}

/**
 * Samples, on every frame for `ms` after the template `id` mounts, each element's opacity and
 * transform inside the frame: which elements other than the entrance changed, and the entrance's own
 * opacities and transforms. Start it before switching to the template.
 */
export function mountMotion(page: Page, id: TemplateId, ms = 600) {
  return canvasFrame(page).evaluate(
    (frame, { id, ms }) =>
      new Promise<{ entrances: number; moved: string[]; entrance: string[] }>((resolve) => {
        const seen = new Map<Element, Set<string>>();
        let start: number | null = null;
        const tick = () => {
          const root = frame.querySelector(`[data-template-root="${id}"]`);
          if (root !== null) {
            start ??= performance.now();
            for (const element of [root, ...root.querySelectorAll("*")]) {
              const style = getComputedStyle(element);
              const values = seen.get(element) ?? new Set<string>();
              values.add(`${style.opacity} ${style.transform}`);
              seen.set(element, values);
            }
          }
          if (start === null || performance.now() - start < ms) {
            requestAnimationFrame(tick);
            return;
          }
          const entrances = frame.querySelectorAll("[data-entrance]");
          const entrance = entrances[0];
          const moved = [...seen]
            .filter(([element, values]) => element !== entrance && values.size > 1)
            .map(
              ([element]) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`,
            );
          resolve({
            entrances: entrances.length,
            moved,
            entrance: entrance === undefined ? [] : [...(seen.get(entrance) ?? [])],
          });
        };
        tick();
      }),
    { id, ms },
  );
}
