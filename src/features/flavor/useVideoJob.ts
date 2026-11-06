import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderOutcome } from "./render";
import type { VideoJob } from "./video";

// The Flavor dialog's one video job (docs/specs/05-motion-3d.md, R5-51 and R5-53; RF4): a render or
// a recording, never both and never two of one. The dialog holds one instance for both sections. A
// press while a job runs starts nothing, "Cancel" and closing the dialog (unmounting) abort the
// job's signal, and the job ends idle once its work settles, so the next press starts afresh.

/** A job's work: it runs under `signal` and says how it ended. */
export type VideoWork = (signal: AbortSignal) => Promise<RenderOutcome>;

export type VideoJobs = {
  /** The job that runs, or null when idle. */
  readonly running: VideoJob | null;
  /** Runs `work` as `job` and gives its outcome; gives null and runs nothing while a job runs. */
  start(job: VideoJob, work: VideoWork): Promise<RenderOutcome | null>;
  /** Aborts the running job's signal; nothing when idle. */
  abort(): void;
};

export function useVideoJob(): VideoJobs {
  const [running, setRunning] = useState<VideoJob | null>(null);
  // The running job's controller, read at the press itself: a double click lands both presses
  // before React renders again, so the state alone would let the second one through.
  const current = useRef<AbortController | null>(null);

  // Closing the dialog aborts its job; the job's end then changes no state of an unmounted hook.
  useEffect(
    () => () => {
      const own = current.current;
      current.current = null;
      own?.abort();
    },
    [],
  );

  const start = useCallback(async (job: VideoJob, work: VideoWork) => {
    if (current.current !== null) return null;
    const own = new AbortController();
    current.current = own;
    setRunning(job);
    try {
      return await work(own.signal);
    } finally {
      if (current.current === own) {
        current.current = null;
        setRunning(null);
      }
    }
  }, []);

  const abort = useCallback(() => {
    current.current?.abort();
  }, []);

  return { running, start, abort };
}
