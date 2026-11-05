import { LOCKABLE, type Lockable } from "@/engine";
import { assertRecord, assertString, describeType, isOneOf } from "./guards";

// The studio's keyboard (spec section 7.3, R2-15): which shortcut a key press means, read from the
// press and the element it targets. Pure apart from reading that element; the page acts on the
// answer and calls `preventDefault` for every shortcut it runs.

/** The parts of a `KeyboardEvent` the rules read. */
export type KeyPress = {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
  /** A held key's repeated press. */
  readonly repeat: boolean;
};

export type Shortcut =
  | { readonly kind: "close-drawer" | "copy-link" | "toggle-mode" | "regenerate" | "undo" | "redo" }
  | { readonly kind: "toggle-lock"; readonly slot: Lockable }
  /** Mod+E: open the export dialog (R3-35). */
  | { readonly kind: "open-export" }
  /** A chord the page keeps from the browser and does nothing with (R3-35). */
  | { readonly kind: "swallow" };

/** The canvas region, `<main aria-label="Canvas">`: it and everything in it keep their keys. */
export const CANVAS_REGION_ATTR = "data-canvas-region";
/** The selector of that attribute. */
export const CANVAS_REGION = `[${CANVAS_REGION_ATTR}]`;
/** On each seed row's native color input and lock toggle: the slot that L locks. */
export const SEED_SLOT = "data-seed-slot";
/** On the inspector's scroll area, which takes focus so Space and the arrows scroll it (R2-15 item 2). */
export const SCROLL_AREA = "data-scroll-area";

/** Input types that are not text fields (R2-15 item 1). */
const NOT_TEXT = new Set(["color", "checkbox", "radio", "range", "button"]);
/** Input types whose control uses Space itself: the checkbox, radio and range roles, and the color picker. */
const KEY_INPUTS = new Set(["checkbox", "radio", "range", "color"]);
/** Roles whose control uses Space or the arrows itself (R2-15 item 2). */
const KEY_ROLES = new Set([
  "button",
  "switch",
  "checkbox",
  "radio",
  "tab",
  "slider",
  "menuitem",
  "option",
]);

/** Whether `element` is or sits in an editable host: `contenteditable` other than "false". */
function isEditable(element: Element): boolean {
  const host = element.closest("[contenteditable]");
  return host !== null && host.getAttribute("contenteditable")?.toLowerCase() !== "false";
}

/**
 * A text field (R2-15 item 1): an `input` whose type takes text (every type but color, checkbox,
 * radio, range and button), a `textarea`, a `select`, or an editable element.
 */
export function isTextField(element: Element): boolean {
  if (element instanceof HTMLInputElement) return !NOT_TEXT.has(element.type);
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  return isEditable(element);
}

/**
 * A control that uses Space or the arrows itself (R2-15 item 2): a button, a summary, a link, a
 * checkbox, radio, range or color input, an element with one of the roles of the ruling, or the
 * inspector's scroll area, which scrolls with them.
 */
export function usesKey(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return true;
  if (element.hasAttribute(SCROLL_AREA)) return true;
  if (element instanceof HTMLInputElement && KEY_INPUTS.has(element.type)) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === "summary") return true;
  if (tag === "a" && element.hasAttribute("href")) return true;
  const role = element.getAttribute("role");
  return role !== null && KEY_ROLES.has(role);
}

/**
 * Mod+S: Ctrl or Meta with the key "s" or the code `KeyS` (S types another letter on some layouts),
 * without Alt or Shift. The share field uses it too, to keep the save dialog shut (F-STUDIO-16).
 */
export function isSaveChord(
  press: Pick<KeyPress, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
): boolean {
  return (
    (press.ctrlKey || press.metaKey) &&
    !press.altKey &&
    !press.shiftKey &&
    (press.key.toLowerCase() === "s" || press.code === "KeyS")
  );
}

/**
 * Mod+E: Ctrl or Meta with the key "e" or the code `KeyE` (a Cyrillic layout types another letter),
 * without Alt or Shift (R3-35).
 */
function isExportChord(
  press: Pick<KeyPress, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
): boolean {
  return (
    (press.ctrlKey || press.metaKey) &&
    !press.altKey &&
    !press.shiftKey &&
    (press.key.toLowerCase() === "e" || press.code === "KeyE")
  );
}

function checkPress(press: KeyPress): void {
  assertRecord(press, "shortcutFor: press");
  assertString(press.key, "shortcutFor: press.key");
  assertString(press.code, "shortcutFor: press.code");
}

/** The slot a seed control names, or null. */
function seedSlot(target: Element | null): Lockable | null {
  const slot = target?.getAttribute(SEED_SLOT);
  return isOneOf(slot, LOCKABLE) ? slot : null;
}

/** Space, ← and →: regenerate, undo and redo on the page (R2-15 item 2). */
const PAGE_KEYS: ReadonlyMap<string, Shortcut> = new Map<string, Shortcut>([
  [" ", { kind: "regenerate" }],
  ["ArrowLeft", { kind: "undo" }],
  ["ArrowRight", { kind: "redo" }],
]);

/**
 * The shortcut a press means, or null when the browser or the focused control keeps the key
 * (R2-15). `target` is the focused element (null reads as the page); `drawerOpen` says whether a
 * modal drawer holds focus; `dialogOpen` (absent reads false) whether a modal dialog is open: then
 * Mod+S and Mod+E are swallowed anywhere and every other key is the dialog's own (R3-35).
 */
export function shortcutFor(
  press: KeyPress,
  target: Element | null,
  context: { readonly drawerOpen: boolean; readonly dialogOpen?: boolean },
): Shortcut | null {
  checkPress(press);
  if (target !== null && !(target instanceof Element)) {
    throw new TypeError(
      `shortcutFor: target must be an element or null, got ${describeType(target)}`,
    );
  }
  assertRecord(context, "shortcutFor: context");
  const { dialogOpen = false } = context;
  if (typeof dialogOpen !== "boolean") {
    throw new TypeError(
      `shortcutFor: context.dialogOpen must be a boolean, got ${describeType(dialogOpen)}`,
    );
  }
  if (press.isComposing) return null;
  // A modal dialog keeps its own keys, Escape included; the page only holds the chords that would
  // open the browser's save dialog or its address bar (R3-35).
  if (dialogOpen) return isSaveChord(press) || isExportChord(press) ? { kind: "swallow" } : null;
  const { key, code, ctrlKey, metaKey, altKey, shiftKey, repeat } = press;
  // Escape is exempt from the text-field rule: a modal drawer closes from every control in it.
  if (key === "Escape") return context.drawerOpen ? { kind: "close-drawer" } : null;
  // The canvas region and everything in it keep their keys (item 5).
  if (target?.closest(CANVAS_REGION)) return null;
  const inText = target !== null && isTextField(target);
  if (ctrlKey || metaKey) {
    if (inText) return null;
    // A repeat copies again, so a held chord never opens the save dialog (item 7).
    if (isSaveChord(press)) return { kind: "copy-link" };
    // A held Mod+E must not open the address bar's search either: a repeat is swallowed (R3-35).
    if (isExportChord(press)) return repeat ? { kind: "swallow" } : { kind: "open-export" };
    return null;
  }
  if (altKey) {
    // Matched on the code: Alt changes the character on some layouts (item 3). A held toggle
    // would flip on every repeat, so a repeat does nothing.
    return code === "KeyT" && !shiftKey && !inText && !repeat ? { kind: "toggle-mode" } : null;
  }
  if (inText) return null;
  if (key.toLowerCase() === "l") {
    if (repeat) return null;
    const slot = seedSlot(target);
    return slot === null ? null : { kind: "toggle-lock", slot };
  }
  const shortcut = PAGE_KEYS.get(key);
  if (shortcut === undefined || shiftKey || context.drawerOpen) return null;
  if (target !== null && usesKey(target)) return null;
  return shortcut;
}
