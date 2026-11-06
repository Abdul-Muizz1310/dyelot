import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionScope } from "@/features/preview/kit";
import {
  type MediaLike,
  useOsReducedMotion,
  watchReducedMotion,
} from "@/features/preview/kit/reduced";

// The OS reduced-motion scope (R5-49, section 10.4).

const seen: unknown[] = [];

vi.mock("motion/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("motion/react")>();
  return {
    ...original,
    MotionConfig: (props: { reducedMotion?: unknown; children?: ReactNode }) => {
      seen.push(props.reducedMotion);
      return <>{props.children}</>;
    },
  };
});

/** A controllable stand-in for the query list. */
function fakeMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initial,
    addEventListener: (_type: "change", listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: "change", listener: () => void) => listeners.delete(listener),
  };
  return {
    media,
    listeners,
    set(next: boolean) {
      media.matches = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

const QUERY = "(prefers-reduced-motion: reduce)";

function stubMatchMedia(media: MediaLike) {
  vi.stubGlobal("matchMedia", (query: string) => {
    expect(query).toBe(QUERY);
    return media;
  });
}

beforeEach(() => {
  seen.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("watchReducedMotion", () => {
  it("C-VT-06 calls onChange with matches at once and on each change, and unsubscribes", () => {
    const fake = fakeMedia(true);
    const onChange = vi.fn();
    const stop = watchReducedMotion(fake.media, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
    fake.set(false);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
    fake.set(true);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(3);
    stop();
    expect(fake.listeners.size).toBe(0);
    fake.set(false);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("C-VT-09 throws a TypeError naming watchReducedMotion for a null media or a non-function", () => {
    const fake = fakeMedia(false);
    expect(() => watchReducedMotion(null as never, () => {})).toThrow(TypeError);
    expect(() => watchReducedMotion(null as never, () => {})).toThrow(/^watchReducedMotion/);
    expect(() => watchReducedMotion(fake.media, 5 as never)).toThrow(TypeError);
    expect(() => watchReducedMotion(fake.media, 5 as never)).toThrow(/^watchReducedMotion/);
    expect(() => watchReducedMotion({ matches: true } as never, () => {})).toThrow(TypeError);
    expect(fake.listeners.size).toBe(0);
  });
});

function Probe({ out }: { out: boolean[] }) {
  out.push(useOsReducedMotion());
  return null;
}

describe("useOsReducedMotion", () => {
  it("C-VT-06 reads false on the server", () => {
    const out: boolean[] = [];
    renderToString(<Probe out={out} />);
    expect(out).toEqual([false]);
  });

  it("C-VT-06 reads the query's matches from the first client render", () => {
    for (const matches of [true, false]) {
      stubMatchMedia(fakeMedia(matches).media);
      const out: boolean[] = [];
      render(<Probe out={out} />);
      expect(out[0]).toBe(matches);
    }
  });
});

describe("MotionScope", () => {
  const spring = { visualDuration: 0.3, bounce: 0.1 };

  it("C-VT-10 passes user while the OS does not match and always once a change reports a match", () => {
    const fake = fakeMedia(false);
    stubMatchMedia(fake.media);
    render(
      <MotionScope reduced={false} spring={spring}>
        <p>x</p>
      </MotionScope>,
    );
    expect(seen.at(-1)).toBe("user");
    act(() => fake.set(true));
    expect(seen.at(-1)).toBe("always");
    act(() => fake.set(false));
    expect(seen.at(-1)).toBe("user");
  });

  it("C-VT-10 passes always with reduced true, whatever the OS says", () => {
    const fake = fakeMedia(false);
    stubMatchMedia(fake.media);
    render(
      <MotionScope reduced spring={spring}>
        <p>x</p>
      </MotionScope>,
    );
    expect(seen.at(-1)).toBe("always");
    act(() => fake.set(true));
    expect(seen.at(-1)).toBe("always");
    act(() => fake.set(false));
    expect(seen.at(-1)).toBe("always");
  });
});
