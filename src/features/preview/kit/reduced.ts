import { useSyncExternalStore } from "react";

// The OS reduced-motion setting, followed live (R5-49, section 10.4).

const QUERY = "(prefers-reduced-motion: reduce)";

export type MediaLike = {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
};

/** Calls `onChange` with `media.matches` at once and on each `change`; returns the unsubscribe. */
export function watchReducedMotion(
  media: MediaLike,
  onChange: (reduced: boolean) => void,
): () => void {
  if (
    typeof media !== "object" ||
    media === null ||
    typeof media.addEventListener !== "function" ||
    typeof media.removeEventListener !== "function"
  ) {
    throw new TypeError("watchReducedMotion: media must be a MediaQueryList");
  }
  if (typeof onChange !== "function") {
    throw new TypeError("watchReducedMotion: onChange must be a function");
  }
  const listener = () => onChange(media.matches);
  media.addEventListener("change", listener);
  onChange(media.matches);
  return () => media.removeEventListener("change", listener);
}

function subscribe(notify: () => void): () => void {
  // The `change` event is the whole notification: the snapshot reads the query itself.
  return watchReducedMotion(window.matchMedia(QUERY), () => notify());
}

const snapshot = (): boolean => window.matchMedia(QUERY).matches;
const serverSnapshot = (): boolean => false;

/** True while the OS asks for reduced motion: false on the server, the query's value on the client. */
export function useOsReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
