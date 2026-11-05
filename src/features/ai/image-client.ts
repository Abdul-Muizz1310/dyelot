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
// is answered: a new read or an abort turns the one before into a cancel, an `AbortError`, and a
// late reply for it is dropped. A worker that fails (it does not load, or its reply cannot be read)
// fails the read in flight and is ended; the next read starts another. Covered by the flows of
// 14.11 (tests/e2e/image.spec.ts), outside the pure floors.

/** The image worker. Turbopack bundles a worker written in this form, as the generator's is. */
export function spawnImageWorker(): Worker {
  return new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
}

export type ImageClient = {
  /** Reads `file` in the worker: its reply, or an `AbortError` when `signal` or a newer read cancels it. */
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

  /** Settles the read in flight with `error`, if any. */
  const failPending = (error: unknown): void => {
    const current = pending;
    pending = null;
    current?.reject(error);
  };

  /** Ends `failed` and fails the read in flight; the next read starts a new worker. */
  const drop = (failed: Worker, what: string): void => {
    failed.terminate();
    if (worker === failed) worker = null;
    failPending(new Error(`createImageClient: the image worker failed (${what})`));
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
      // Only the newest read is answered.
      failPending(canceled());
      if (signal.aborted) return Promise.reject(canceled());
      lastId += 1;
      const id = lastId;
      return new Promise<ImageReply>((resolve, reject) => {
        const onAbort = () => {
          if (pending?.id === id) failPending(canceled());
        };
        signal.addEventListener("abort", onAbort, { once: true });
        pending = {
          id,
          resolve(reply) {
            signal.removeEventListener("abort", onAbort);
            resolve(reply);
          },
          reject(error) {
            signal.removeEventListener("abort", onAbort);
            reject(error);
          },
        };
        try {
          worker ??= start();
          const request: ImageRequest = { id, file };
          worker.postMessage(request);
        } catch (error) {
          failPending(error);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      failPending(canceled());
      worker?.terminate();
      worker = null;
    },
  };
}
