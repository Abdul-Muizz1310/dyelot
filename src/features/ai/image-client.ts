import {
  type ImageReply,
  type ImageRequest,
  imageAccepted,
  parseImageReply,
} from "@/features/ai/image-protocol";
import { assertSignal } from "@/features/ai/load";
import { describeType } from "@/features/studio/guards";

// The image worker's client (docs/specs/04-ai.md, 9.1's last paragraph, R4-46; D2): one worker,
// started on the first read, so the studio's first load fetches no quantizer. Only the newest read
// is answered. A read that ends without its reply ends the worker too, so no decode goes on behind
// it: a newer read or an abort cancels it (an `AbortError`), and a read past
// `IMAGE_READ_TIMEOUT_MS` fails (a `TimeoutError`). A worker that fails (it does not load, or its
// reply cannot be read) fails the read in flight and is ended. The next read starts a new worker.
// Covered by the flows of 14.11 (tests/e2e/image.spec.ts) and tests/unit/features/ai/image-client
// .test.ts, outside the pure floors.

/** How long a read may take before it fails and its worker is ended (9.1): 20 seconds. */
export const IMAGE_READ_TIMEOUT_MS = 20_000;

/** The image worker. Turbopack bundles a worker written in this form, as the generator's is. */
export function spawnImageWorker(): Worker {
  return new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
}

export type ImageClient = {
  /**
   * Reads `file` in the worker: its reply, an `AbortError` when `signal` or a newer read cancels
   * it, or a `TimeoutError` past `IMAGE_READ_TIMEOUT_MS`.
   */
  read(file: Blob, signal: AbortSignal): Promise<ImageReply>;
  /** Ends the worker; a read in flight is canceled, and no read may follow. */
  dispose(): void;
};

/** The read in flight: its id and how to settle its promise. */
type Pending = {
  readonly id: number;
  resolve(reply: ImageReply): void;
  reject(error: unknown): void;
};

const canceled = (): DOMException => new DOMException("The image read was canceled.", "AbortError");
const timedOut = (): DOMException =>
  new DOMException(`The image read took longer than ${IMAGE_READ_TIMEOUT_MS} ms.`, "TimeoutError");

/**
 * A client over one worker made by `spawn` (by default `spawnImageWorker`), started lazily. A file
 * must be one `imageAccepted` takes (else a RangeError): the section checks it first and shows its
 * message, so a refused file never reaches the worker.
 */
export function createImageClient(spawn: () => Worker = spawnImageWorker): ImageClient {
  if (typeof spawn !== "function") {
    throw new TypeError(`createImageClient: spawn must be a function, got ${describeType(spawn)}`);
  }
  let worker: Worker | null = null;
  let pending: Pending | null = null;
  let lastId = 0;
  let disposed = false;

  /** Ends the worker, if one runs; the next read starts a new one. */
  const endWorker = (): void => {
    worker?.terminate();
    worker = null;
  };

  /**
   * Ends the read in flight, if any, with `error`, and its worker with it, so the worker stops
   * whatever it decodes for that read.
   */
  const endPending = (error: unknown): void => {
    const current = pending;
    if (current === null) return;
    pending = null;
    endWorker();
    current.reject(error);
  };

  /** Ends `failed` and fails the read in flight. */
  const drop = (failed: Worker, what: string): void => {
    failed.terminate();
    if (worker === failed) worker = null;
    endPending(new Error(`createImageClient: the image worker failed (${what})`));
  };

  const start = (): Worker => {
    const started = spawn();
    started.addEventListener("message", (event: MessageEvent<unknown>) => {
      const reply = parseImageReply(event.data);
      if (reply === null) {
        drop(started, "an unreadable reply");
        return;
      }
      // A reply for a read that was canceled or replaced is dropped.
      if (pending === null || reply.id !== pending.id) return;
      const current = pending;
      pending = null;
      current.resolve(reply);
    });
    started.addEventListener("error", (event) => {
      // Handled here: keep the browser from reporting it as uncaught.
      event.preventDefault();
      drop(started, "error");
    });
    started.addEventListener("messageerror", () => drop(started, "messageerror"));
    return started;
  };

  return {
    read(file, signal) {
      if (!(file instanceof Blob)) {
        throw new TypeError(`read: file must be a Blob, got ${describeType(file)}`);
      }
      assertSignal(signal, "read: signal");
      if (disposed) throw new RangeError("read: the image client was disposed");
      const accepted = imageAccepted(file.type, file.size);
      if (!accepted.ok) {
        throw new RangeError(
          `read: the file is not an image the studio takes (${accepted.message})`,
        );
      }
      // Only the newest read is answered: the one before is canceled, and its worker ended.
      endPending(canceled());
      if (signal.aborted) return Promise.reject(canceled());
      lastId += 1;
      const id = lastId;
      return new Promise<ImageReply>((resolve, reject) => {
        const onAbort = () => {
          if (pending?.id === id) endPending(canceled());
        };
        const timer = setTimeout(() => {
          if (pending?.id === id) endPending(timedOut());
        }, IMAGE_READ_TIMEOUT_MS);
        const settle = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", onAbort);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        pending = {
          id,
          resolve(reply) {
            settle();
            resolve(reply);
          },
          reject(error) {
            settle();
            reject(error);
          },
        };
        try {
          worker ??= start();
          const request: ImageRequest = { id, file };
          worker.postMessage(request);
        } catch (error) {
          endPending(error);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      endPending(canceled());
      endWorker();
    },
  };
}
