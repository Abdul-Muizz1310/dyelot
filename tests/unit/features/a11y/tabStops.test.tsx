import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tabStops } from "@/features/a11y/tabStops";

// jsdom has no layout, so `getClientRects()` is empty for every element: the stub makes an element
// rendered unless it, or an ancestor, carries `hidden`.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLElement,
  ) {
    return (this.closest("[hidden]") === null ? [{}] : []) as unknown as DOMRectList;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function render(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

describe("tabStops", () => {
  it("counts a radio group once when its checked radio is not the last, so Tab stays inside", () => {
    const container = render(
      `<input type="radio" name="g" id="a"><input type="radio" name="g" id="b" checked><input type="radio" name="g" id="c"><button id="end">End</button>`,
    );
    expect(tabStops(container).map((element) => element.id)).toEqual(["b", "end"]);
  });

  it("falls back to the first radio when none is checked", () => {
    const container = render(
      `<input type="radio" name="g" id="a"><input type="radio" name="g" id="b"><button id="end">End</button>`,
    );
    expect(tabStops(container).map((element) => element.id)).toEqual(["a", "end"]);
  });

  it("skips disabled controls, tabindex -1 and anything not rendered, and keeps a summary", () => {
    const container = render(
      `<button id="off" disabled>x</button><a id="skip" href="#" tabindex="-1">s</a><div hidden><button id="gone">g</button></div><details><summary id="sum">s</summary></details><fieldset disabled><input id="fs"></fieldset><button id="end">e</button>`,
    );
    expect(tabStops(container).map((element) => element.id)).toEqual(["sum", "end"]);
  });
});
