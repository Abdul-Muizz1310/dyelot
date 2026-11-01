import { afterEach, describe, expect, it } from "vitest";
import {
  CANVAS_REGION,
  isSaveChord,
  isTextField,
  type KeyPress,
  SEED_SLOT,
  shortcutFor,
  usesKey,
} from "@/features/studio/shortcuts";

// Cases C-KEYS-01 to C-KEYS-12 of docs/specs/02-studio.md, section 6.11: the key rules of R2-15.

const NO_DRAWER = { drawerOpen: false };
const DRAWER = { drawerOpen: true };

/** A plain press of `key` with `code`, no modifier held. */
function press(key: string, code: string, held: Partial<KeyPress> = {}): KeyPress {
  return {
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    repeat: false,
    ...held,
  };
}

const SPACE = press(" ", "Space");
const LEFT = press("ArrowLeft", "ArrowLeft");
const RIGHT = press("ArrowRight", "ArrowRight");
const L = press("l", "KeyL");
const ALT_T = press("t", "KeyT", { altKey: true });
const CTRL_S = press("s", "KeyS", { ctrlKey: true });
const META_S = press("s", "KeyS", { metaKey: true });
const ESCAPE = press("Escape", "Escape");

/** Builds `html` into the body and returns the element marked `data-target` (or the first). */
function build(html: string): Element {
  document.body.innerHTML = html;
  const target = document.body.querySelector("[data-target]") ?? document.body.firstElementChild;
  if (target === null) throw new Error("build: no element");
  return target;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shortcutFor on the page", () => {
  it("C-KEYS-01 gives the same for a held key: Space, ← and → fire on every repeat", () => {
    const held = { repeat: true };
    expect(shortcutFor({ ...SPACE, ...held }, document.body, NO_DRAWER)).toEqual({
      kind: "regenerate",
    });
    expect(shortcutFor({ ...LEFT, ...held }, null, NO_DRAWER)).toEqual({ kind: "undo" });
    expect(shortcutFor({ ...RIGHT, ...held }, null, NO_DRAWER)).toEqual({ kind: "redo" });
  });

  it("C-KEYS-01 gives regenerate for Space, undo for ← and redo for → on the body", () => {
    expect(shortcutFor(SPACE, document.body, NO_DRAWER)).toEqual({ kind: "regenerate" });
    expect(shortcutFor(LEFT, document.body, NO_DRAWER)).toEqual({ kind: "undo" });
    expect(shortcutFor(RIGHT, document.body, NO_DRAWER)).toEqual({ kind: "redo" });
  });

  it("C-KEYS-01 treats a null target as the page", () => {
    expect(shortcutFor(SPACE, null, NO_DRAWER)).toEqual({ kind: "regenerate" });
    expect(shortcutFor(LEFT, null, NO_DRAWER)).toEqual({ kind: "undo" });
  });

  it("C-KEYS-01 fires on a non-control element of the header", () => {
    const tag = build("<header><p data-target>LOT 0123·4567</p></header>");
    expect(shortcutFor(SPACE, tag, NO_DRAWER)).toEqual({ kind: "regenerate" });
    expect(shortcutFor(RIGHT, tag, NO_DRAWER)).toEqual({ kind: "redo" });
  });

  it("C-KEYS-01 keeps Shift+Space and Shift+arrows for the browser", () => {
    expect(shortcutFor({ ...SPACE, shiftKey: true }, null, NO_DRAWER)).toBeNull();
    expect(shortcutFor({ ...LEFT, shiftKey: true }, null, NO_DRAWER)).toBeNull();
  });
});

describe("text fields (R2-15 item 1)", () => {
  const FIELDS = [
    '<input type="text">',
    "<input>",
    '<input type="email">',
    '<input type="number">',
    '<input type="search">',
    '<input type="url">',
    '<input type="tel">',
    '<input type="password">',
    '<input type="date">',
    "<textarea></textarea>",
    "<select><option>a</option></select>",
    '<div contenteditable="true"></div>',
    '<div contenteditable=""></div>',
    '<div contenteditable="plaintext-only"></div>',
    '<div contenteditable="true"><p data-target>child</p></div>',
  ];

  it.each(FIELDS)("C-KEYS-02 %s is a text field and ignores every studio key", (html) => {
    const field = build(html);
    expect(isTextField(field)).toBe(true);
    for (const key of [SPACE, LEFT, RIGHT, L, ALT_T, CTRL_S, META_S]) {
      expect(shortcutFor(key, field, NO_DRAWER)).toBeNull();
    }
  });

  it("C-KEYS-02 a seed slot on a text field does not make L fire", () => {
    const field = build(`<input type="text" ${SEED_SLOT}="primary">`);
    expect(shortcutFor(L, field, NO_DRAWER)).toBeNull();
  });

  it.each([
    '<input type="color">',
    '<input type="checkbox">',
    '<input type="radio">',
    '<input type="range">',
    '<input type="button">',
    '<div contenteditable="false"></div>',
    "<button>b</button>",
    "<div></div>",
  ])("C-KEYS-03 %s is not a text field", (html) => {
    expect(isTextField(build(html))).toBe(false);
  });
});

describe("controls that use the key (R2-15 item 2)", () => {
  const CONTROLS = [
    "<button>b</button>",
    "<details><summary>s</summary></details>",
    '<a href="/">a</a>',
    '<input type="checkbox">',
    '<input type="radio">',
    '<input type="range">',
    '<input type="color">',
    ...["button", "switch", "checkbox", "radio", "tab", "slider", "menuitem", "option"].map(
      (role) => `<div role="${role}" tabindex="0">r</div>`,
    ),
  ];

  it.each(CONTROLS)("C-KEYS-04 Space, ← and → give null on %s", (html) => {
    const target = html.startsWith("<details")
      ? build(html.replace("<summary>", "<summary data-target>"))
      : build(html);
    expect(usesKey(target)).toBe(true);
    for (const key of [SPACE, LEFT, RIGHT]) {
      expect(shortcutFor(key, target, NO_DRAWER)).toBeNull();
    }
  });

  it("C-KEYS-04 a link without href and a plain element do not use the key", () => {
    expect(usesKey(build("<a>no href</a>"))).toBe(false);
    expect(usesKey(build('<div role="region" aria-label="r"></div>'))).toBe(false);
    expect(usesKey(build("<p>text</p>"))).toBe(false);
  });
});

describe("L toggles the lock of the focused seed (R2-15 item 4)", () => {
  it.each([
    ["primary", '<input type="color">'],
    ["secondary", '<button aria-pressed="false">lock</button>'],
    ["accent", '<input type="color">'],
  ] as const)("C-KEYS-05 L on a %s seed control gives toggle-lock for it", (slot, html) => {
    const control = build(html.replace(/^<(\w+)/, `<$1 ${SEED_SLOT}="${slot}"`));
    expect(shortcutFor(L, control, NO_DRAWER)).toEqual({ kind: "toggle-lock", slot });
    expect(shortcutFor(press("L", "KeyL", { shiftKey: true }), control, NO_DRAWER)).toEqual({
      kind: "toggle-lock",
      slot,
    });
  });

  it("C-KEYS-05 L gives null away from a seed control, with a modifier, or with a bad slot", () => {
    expect(shortcutFor(L, document.body, NO_DRAWER)).toBeNull();
    expect(shortcutFor(L, null, NO_DRAWER)).toBeNull();
    expect(shortcutFor(L, build("<button>other</button>"), NO_DRAWER)).toBeNull();
    const control = build(`<button ${SEED_SLOT}="primary">lock</button>`);
    for (const held of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(shortcutFor(press("l", "KeyL", held), control, NO_DRAWER)).toBeNull();
    }
    expect(shortcutFor(L, build(`<button ${SEED_SLOT}="neutral">lock</button>`), NO_DRAWER)).toBe(
      null,
    );
  });
});

describe("Alt+T flips the mode, matched on the code (R2-15 item 3)", () => {
  it.each([["t"], ["†"], ["T"]])(
    "C-KEYS-06 Alt with code KeyT and key %j toggles the mode",
    (key) => {
      expect(shortcutFor(press(key, "KeyT", { altKey: true }), null, NO_DRAWER)).toEqual({
        kind: "toggle-mode",
      });
    },
  );

  it("C-KEYS-06 another code, Shift or Ctrl with Alt gives null", () => {
    expect(shortcutFor(press("t", "KeyY", { altKey: true }), null, NO_DRAWER)).toBeNull();
    expect(
      shortcutFor(press("T", "KeyT", { altKey: true, shiftKey: true }), null, NO_DRAWER),
    ).toBeNull();
    expect(
      shortcutFor(press("t", "KeyT", { altKey: true, ctrlKey: true }), null, NO_DRAWER),
    ).toBeNull();
    expect(shortcutFor(press("t", "KeyT"), null, NO_DRAWER)).toBeNull();
  });
});

describe("Mod+S copies the link (R2-15 items 3 and 7)", () => {
  it("C-KEYS-07 Mod+S is matched on the code KeyS too, for layouts where S types another letter", () => {
    expect(shortcutFor(press("ы", "KeyS", { ctrlKey: true }), null, NO_DRAWER)).toEqual({
      kind: "copy-link",
    });
    expect(shortcutFor(press("ы", "KeyS", { metaKey: true }), null, NO_DRAWER)).toEqual({
      kind: "copy-link",
    });
    expect(shortcutFor(press("ы", "KeyS", { ctrlKey: true }), build("<input>"), NO_DRAWER)).toBe(
      null,
    );
  });

  it("C-KEYS-07 isSaveChord is Ctrl or Meta with s or KeyS, without Alt or Shift, wherever focus is", () => {
    expect(isSaveChord(CTRL_S)).toBe(true);
    expect(isSaveChord(META_S)).toBe(true);
    expect(isSaveChord(press("ы", "KeyS", { ctrlKey: true, repeat: true }))).toBe(true);
    expect(isSaveChord({ ...CTRL_S, altKey: true })).toBe(false);
    expect(isSaveChord({ ...CTRL_S, shiftKey: true })).toBe(false);
    expect(isSaveChord(press("s", "KeyS"))).toBe(false);
    expect(isSaveChord(press("d", "KeyD", { ctrlKey: true }))).toBe(false);
  });

  it("C-KEYS-07 a held Mod+S keeps copying, so the save dialog stays shut on every repeat", () => {
    expect(shortcutFor({ ...CTRL_S, repeat: true }, null, NO_DRAWER)).toEqual({
      kind: "copy-link",
    });
  });

  it("C-KEYS-07 Ctrl+S and Meta+S give copy-link outside a text field", () => {
    expect(shortcutFor(CTRL_S, null, NO_DRAWER)).toEqual({ kind: "copy-link" });
    expect(shortcutFor(META_S, build("<button>b</button>"), NO_DRAWER)).toEqual({
      kind: "copy-link",
    });
    expect(shortcutFor(press("S", "KeyS", { ctrlKey: true }), null, NO_DRAWER)).toEqual({
      kind: "copy-link",
    });
  });

  it("C-KEYS-07 Mod+S with Alt or Shift, and any other Mod chord, gives null", () => {
    expect(shortcutFor({ ...CTRL_S, altKey: true }, null, NO_DRAWER)).toBeNull();
    expect(shortcutFor({ ...META_S, shiftKey: true }, null, NO_DRAWER)).toBeNull();
    for (const [key, code] of [
      [" ", "Space"],
      ["ArrowLeft", "ArrowLeft"],
      ["l", "KeyL"],
      ["z", "KeyZ"],
    ]) {
      expect(shortcutFor(press(key, code, { ctrlKey: true }), null, NO_DRAWER)).toBeNull();
      expect(shortcutFor(press(key, code, { metaKey: true }), null, NO_DRAWER)).toBeNull();
    }
  });
});

describe("Escape closes a drawer (R2-15 item 6)", () => {
  it("C-KEYS-08 gives close-drawer from any target when a drawer is open", () => {
    expect(shortcutFor(ESCAPE, null, DRAWER)).toEqual({ kind: "close-drawer" });
    expect(shortcutFor(ESCAPE, build('<input type="text">'), DRAWER)).toEqual({
      kind: "close-drawer",
    });
    expect(shortcutFor(ESCAPE, build("<select><option>a</option></select>"), DRAWER)).toEqual({
      kind: "close-drawer",
    });
  });

  it("C-KEYS-08 gives null with no drawer open", () => {
    expect(shortcutFor(ESCAPE, null, NO_DRAWER)).toBeNull();
  });
});

describe("the canvas keeps its keys (R2-15 item 5)", () => {
  it.each([
    [`<main aria-label="Canvas" tabindex="0" data-canvas-region data-target></main>`],
    [
      `<main aria-label="Canvas" data-canvas-region><div data-canvas><input type="checkbox" data-target></div></main>`,
    ],
    [
      `<main aria-label="Canvas" data-canvas-region><div data-canvas><div role="tab" tabindex="0" data-target ${SEED_SLOT}="primary">t</div></div></main>`,
    ],
    [`<main aria-label="Canvas" data-canvas-region><p data-target>text</p></main>`],
  ])("C-KEYS-09 every studio key gives null for %s", (html) => {
    const target = build(html);
    expect(target.closest(CANVAS_REGION)).not.toBeNull();
    for (const key of [SPACE, LEFT, RIGHT, L, ALT_T, CTRL_S, META_S]) {
      expect(shortcutFor(key, target, NO_DRAWER)).toBeNull();
    }
  });
});

describe("an open drawer keeps Space and the arrows (R2-15 item 2)", () => {
  it("C-KEYS-10 Space, ← and → give null; L, Alt+T and Mod+S still fire", () => {
    const heading = build(
      '<aside aria-label="Inputs"><h2 tabindex="-1" data-target>Inputs</h2></aside>',
    );
    for (const key of [SPACE, LEFT, RIGHT]) {
      expect(shortcutFor(key, heading, DRAWER)).toBeNull();
      expect(shortcutFor(key, null, DRAWER)).toBeNull();
    }
    expect(shortcutFor(ALT_T, heading, DRAWER)).toEqual({ kind: "toggle-mode" });
    expect(shortcutFor(CTRL_S, heading, DRAWER)).toEqual({ kind: "copy-link" });
    const lock = build(`<button ${SEED_SLOT}="accent">lock</button>`);
    expect(shortcutFor(L, lock, DRAWER)).toEqual({ kind: "toggle-lock", slot: "accent" });
  });
});

describe("held toggles (C-KEYS-13)", () => {
  it("C-KEYS-13 a repeated L or Alt+T gives null, so a held toggle does not flicker", () => {
    const lock = build(`<button ${SEED_SLOT}="primary">lock</button>`);
    expect(shortcutFor({ ...L, repeat: true }, lock, NO_DRAWER)).toBeNull();
    expect(shortcutFor({ ...ALT_T, repeat: true }, null, NO_DRAWER)).toBeNull();
    expect(shortcutFor(L, lock, NO_DRAWER)).toEqual({ kind: "toggle-lock", slot: "primary" });
  });
});

describe("other presses", () => {
  it("C-KEYS-11 a press during composition gives null", () => {
    for (const key of [SPACE, LEFT, ALT_T, CTRL_S, ESCAPE]) {
      expect(shortcutFor({ ...key, isComposing: true }, null, DRAWER)).toBeNull();
    }
  });

  it.each([
    ["a", "KeyA"],
    ["Enter", "Enter"],
    ["ArrowUp", "ArrowUp"],
    ["ArrowDown", "ArrowDown"],
    ["Tab", "Tab"],
    ["Alt", "AltLeft"],
  ])("C-KEYS-11 %j gives null", (key, code) => {
    expect(shortcutFor(press(key, code), null, NO_DRAWER)).toBeNull();
  });
});

describe("shortcutFor checks its input (R-05)", () => {
  it.each([[null], [undefined], ["Space"], [[]]])(
    "C-KEYS-12 throws TypeError naming shortcutFor for a press of %j",
    (value) => {
      expect(() => shortcutFor(value as never, null, NO_DRAWER)).toThrow(TypeError);
      expect(() => shortcutFor(value as never, null, NO_DRAWER)).toThrow(/^shortcutFor: /);
    },
  );

  it("C-KEYS-12 throws TypeError for a key or code that is not a string", () => {
    expect(() => shortcutFor({ ...SPACE, key: 32 } as never, null, NO_DRAWER)).toThrow(
      "shortcutFor: press.key must be a string, got number",
    );
    expect(() => shortcutFor({ ...SPACE, code: undefined } as never, null, NO_DRAWER)).toThrow(
      "shortcutFor: press.code must be a string, got undefined",
    );
  });

  it("C-KEYS-12 throws TypeError for a target that is not an element or null", () => {
    expect(() => shortcutFor(SPACE, document as never, NO_DRAWER)).toThrow(TypeError);
    expect(() => shortcutFor(SPACE, {} as never, NO_DRAWER)).toThrow(
      /^shortcutFor: target must be an element or null/,
    );
  });

  it("C-KEYS-12 throws TypeError for a context that is not an object", () => {
    expect(() => shortcutFor(SPACE, null, null as never)).toThrow(
      "shortcutFor: context must be an object, got null",
    );
  });
});
