import { afterEach, describe, expect, it, vi } from "vitest";
import { createImageClient, IMAGE_READ_TIMEOUT_MS } from "@/features/ai/image-client";
import type { ImageReply } from "@/features/ai/image-protocol";

// The image worker's client (docs/specs/04-ai.md, 9.1's last paragraph; controller ruling on Task
// 4.10b's review): one worker, the newest read only; a cancel, a newer read or a read past
// IMAGE_READ_TIMEOUT_MS ends the worker, so no decode goes on after it, and the next read starts a
// new worker. A fake worker stands in for the real one.

class FakeWorker extends EventTarget {
  readonly posted: unknown[] = [];
  terminated = false;
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  /** Delivers `data` as the worker's message. */
  reply(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function harness() {
  const spawned: FakeWorker[] = [];
  const client = createImageClient(() => {
    const worker = new FakeWorker();
    spawned.push(worker);
    return worker as unknown as Worker;
  });
  return { client, spawned };
}

const png = () => new Blob([new Uint8Array(8)], { type: "image/png" });
const ok = (id: number): ImageReply => ({
  id,
  ok: true,
  clusters: [{ hex: "#b8422e", share: 1 }],
  width: 1,
  height: 1,
  jpeg: null,
});
const idOf = (worker: FakeWorker | undefined, at = 0) =>
  (worker?.posted[at] as { id: number } | undefined)?.id ?? -1;

afterEach(() => {
  vi.useRealTimers();
});

describe("9.1 the image client", () => {
  it("9.1 a read gets its reply, and a later read reuses the worker", async () => {
    const { client, spawned } = harness();
    const first = client.read(png(), new AbortController().signal);
    spawned[0]?.reply(ok(idOf(spawned[0])));
    await expect(first).resolves.toEqual(ok(1));
    const second = client.read(png(), new AbortController().signal);
    spawned[0]?.reply(ok(idOf(spawned[0], 1)));
    await expect(second).resolves.toEqual(ok(2));
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.terminated).toBe(false);
  });

  it("9.1 a newer read cancels the older one and ends its worker, so its decode stops", async () => {
    const { client, spawned } = harness();
    const older = client.read(png(), new AbortController().signal);
    const newer = client.read(png(), new AbortController().signal);
    await expect(older).rejects.toMatchObject({ name: "AbortError" });
    expect(spawned[0]?.terminated).toBe(true);
    expect(spawned).toHaveLength(2);
    // A late reply from the ended worker is dropped; the new worker answers the newer read.
    spawned[0]?.reply(ok(1));
    spawned[1]?.reply(ok(idOf(spawned[1])));
    await expect(newer).resolves.toEqual(ok(2));
  });

  it("9.1 an abort cancels the read and ends the worker; the next read starts a new one", async () => {
    const { client, spawned } = harness();
    const controller = new AbortController();
    const read = client.read(png(), controller.signal);
    controller.abort();
    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    expect(spawned[0]?.terminated).toBe(true);
    const next = client.read(png(), new AbortController().signal);
    expect(spawned).toHaveLength(2);
    spawned[1]?.reply(ok(idOf(spawned[1])));
    await expect(next).resolves.toEqual(ok(2));
  });

  it("9.1 a read past IMAGE_READ_TIMEOUT_MS fails with a TimeoutError and ends the worker", async () => {
    vi.useFakeTimers();
    expect(IMAGE_READ_TIMEOUT_MS).toBe(20_000);
    const { client, spawned } = harness();
    const read = client.read(png(), new AbortController().signal);
    const settled = read.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(IMAGE_READ_TIMEOUT_MS - 1);
    expect(spawned[0]?.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toMatchObject({ name: "TimeoutError" });
    expect(spawned[0]?.terminated).toBe(true);
  });

  it("9.1 a reply in time clears the timer", async () => {
    vi.useFakeTimers();
    const { client, spawned } = harness();
    const read = client.read(png(), new AbortController().signal);
    spawned[0]?.reply(ok(idOf(spawned[0])));
    await expect(read).resolves.toEqual(ok(1));
    await vi.advanceTimersByTimeAsync(IMAGE_READ_TIMEOUT_MS * 2);
    expect(spawned[0]?.terminated).toBe(false);
  });

  it("9.1 a refused file, a wrong argument or a disposed client throws before anything is posted", () => {
    const { client, spawned } = harness();
    const svg = new Blob(["<svg/>"], { type: "image/svg+xml" });
    expect(() => client.read(svg, new AbortController().signal)).toThrow(RangeError);
    expect(() => client.read("x" as unknown as Blob, new AbortController().signal)).toThrow(
      TypeError,
    );
    expect(() => client.read(png(), "x" as unknown as AbortSignal)).toThrow(TypeError);
    expect(spawned).toHaveLength(0);
    client.dispose();
    expect(() => client.read(png(), new AbortController().signal)).toThrow(RangeError);
  });
});
