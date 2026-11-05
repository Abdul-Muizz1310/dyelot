"use client";

import { type DragEvent, useEffect, useRef, useState } from "react";
import { type ImagePalette, imagePalette } from "@/engine";
import { ActionButton, ActionStatus } from "@/features/ai/ActionButton";
import type { AiActivity } from "@/features/ai/activity";
import { createImageClient, type ImageClient } from "@/features/ai/image-client";
import { IMAGE_TYPES, type ImageReply, imageAccepted } from "@/features/ai/image-protocol";
import { type AiModule, loadAi } from "@/features/ai/load";
import { runProviders } from "@/features/ai/router";
import { browserDeps, createdWithOf, failureLines, stepsFor } from "@/features/ai/steps";
import {
  type ActionLines,
  CANCELED_LINE,
  LOAD_FAILED_LINE,
  useAiAction,
} from "@/features/ai/useAiAction";
import type { StudioStore } from "@/features/studio/store";

// The Image section of the inputs panel (docs/specs/04-ai.md, 13.3, R4-46 to R4-48): the visitor
// chooses or drops an image; the worker reads its colors on the device, and the heuristic roles
// apply at once as one commit with `createdWith: "controls"`. "Read the vibe" then sends a smaller
// copy, and only on that click, to the visitor key or the shared quota (never the on-device model,
// R4-31), and applies the model's roles, tint, pairing, moods and preset as one commit, built on the
// store's state when the answer lands (R4-37). Section 13's strings, word for word.

const INPUT_LABEL = "Choose an image";
const ZONE_TEXT = "Choose an image or drop one here";
const READING = "Reading the image's colors…";
const LIST_LABEL = "Colors in the image";
const NO_IMAGE = "Choose an image first.";
const NO_JPEG = "This image is too detailed to send. Try a smaller one.";
const PRIVACY =
  "Sends a smaller copy of the image to OpenRouter and the model's provider, through your key or dyelot's shared quota.";
const RULES_LINE = "The seeds stay the image's colors (no model).";
const READ_FAILED = "That image could not be read. Choose another one.";
/** 13.3's message for each error the worker gives. */
const ERRORS: Readonly<Record<Extract<ImageReply, { ok: false }>["error"], string>> = {
  decode: READ_FAILED,
  quantize: READ_FAILED,
  "too-many-pixels": "That image has more than 50 million pixels. Choose a smaller one.",
};

type ImageJpeg = NonNullable<Extract<ImageReply, { ok: true }>["jpeg"]>;
/** The image the section holds: its palette and the JPEG "Read the vibe" may send. */
export type HeldImage = { readonly palette: ImagePalette; readonly jpeg: ImageJpeg | null };

/**
 * Why "Read the vibe" cannot run for the image held (13.3), or null when it can: no image read yet,
 * or a worker that gave no JPEG because it stayed over `JPEG_MAX_BYTES` at both qualities.
 */
export function vibeReason(held: HeldImage | null): string | null {
  if (held === null) return NO_IMAGE;
  return held.jpeg === null ? NO_JPEG : null;
}

/** The section's lines as its status region shows them: the last one is the result. */
const asLines = (lines: readonly string[]): ActionLines => ({
  failures: lines.slice(0, -1),
  result: lines.at(-1) ?? null,
});

/** Whether a read failed because it took longer than the client allows (9.1). */
const isTimeout = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "TimeoutError";

/** 13.3's seeds line: each role's cluster hex, absent roles left out. */
function seedsLine(palette: ImagePalette): string {
  const parts = (["primary", "secondary", "accent"] as const).flatMap((role) => {
    const id = palette.roles[role];
    const cluster = palette.clusters.find((entry) => entry.id === id);
    return cluster === undefined ? [] : [`${role} ${cluster.hex}`];
  });
  return `Seeds: ${parts.join(", ")}.`;
}

/** The JPEG's data URL, `data:image/jpeg;base64,` and standard base64 with padding (9.3), made here. */
function jpegDataUrl(bytes: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new TypeError("jpegDataUrl: the reader gave no text"));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("jpegDataUrl: the reader failed"));
    });
    reader.readAsDataURL(new Blob([bytes], { type: "image/jpeg" }));
  });
}

/**
 * Reads the vibe of a held image and applies what it gives as one commit (13.3, R4-48): the lines
 * to show. The image leaves the device only here. A cancel, or the rules, leave the design as the
 * extraction made it.
 */
export async function readVibe(
  ai: AiModule,
  deps: {
    store: StudioStore;
    activity: AiActivity;
    image: { readonly palette: ImagePalette; readonly jpeg: ImageJpeg };
    signal: AbortSignal;
  },
): Promise<{ failures: readonly string[]; result: string }> {
  const { store, activity, image, signal } = deps;
  const dataUrl = await jpegDataUrl(image.jpeg.bytes);
  if (signal.aborted) return { failures: [], result: CANCELED_LINE };
  const input = ai.vibeInput(image.palette, {
    dataUrl,
    width: image.jpeg.width,
    height: image.jpeg.height,
  });
  const routed = await runProviders(stepsFor(ai, "vibe", input, browserDeps(activity)), signal);
  if (routed.kind === "canceled" || signal.aborted) return { failures: [], result: CANCELED_LINE };
  if (routed.kind === "rules") {
    return { failures: failureLines(ai, routed.failures, "vibe", "rules"), result: RULES_LINE };
  }
  const { path, output } = routed;
  // The router answers a model's path only from a model's step (runProviders checks it).
  if (path.provider === "rules") throw new RangeError("readVibe: the rules answered as a model");
  const failures = failureLines(ai, routed.failures, "vibe", path.provider);
  // Built on the store's state now, with the clusters the model was shown.
  const { preset, patch } = ai.vibeChange(output, {
    params: store.getState().params,
    palette: image.palette,
  });
  const result = `${ai.madeWith(path, "vibe")} Mood: ${output.moodTags.join(", ")}.`;
  store.getState().applyAi({ preset, patch, createdWith: createdWithOf(path) });
  return { failures, result };
}

export function ImageSection({ store, activity }: { store: StudioStore; activity: AiActivity }) {
  const vibe = useAiAction(activity, "vibe");
  const [held, setHeld] = useState<HeldImage | null>(null);
  const [imageLines, setImageLines] = useState<readonly string[]>([]);
  /** Which lines the section's one status region shows: the latest read's or the vibe's. */
  const [shown, setShown] = useState<"image" | "vibe">("image");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const client = useRef<ImageClient | null>(null);
  const reading = useRef<AbortController | null>(null);

  // Leaving the studio cancels a read and ends the worker.
  useEffect(
    () => () => {
      reading.current?.abort();
      reading.current = null;
      client.current?.dispose();
      client.current = null;
    },
    [],
  );

  /**
   * Reads a chosen or dropped file (13.3). The type and size are checked first: a refused file
   * shows its message and changes nothing else, so a read or a vibe in progress goes on and the
   * image held stays. An accepted file cancels a read in progress (its worker is ended) and a vibe
   * still reading, which belongs to the image before; the image before is let go, so "Read the
   * vibe" never sends an image the design no longer follows. The worker then reads it, and the
   * roles apply as one commit as soon as it ends. A failure leaves the design as it was.
   */
  async function extract(file: File): Promise<void> {
    const accepted = imageAccepted(file.type, file.size);
    setShown("image");
    if (!accepted.ok) {
      setImageLines([accepted.message]);
      return;
    }
    vibe.cancel();
    reading.current?.abort();
    const own = new AbortController();
    reading.current = own;
    setHeld(null);
    setImageLines([READING]);
    let reply: ImageReply;
    let ai: AiModule;
    try {
      client.current ??= createImageClient();
      [reply, ai] = await Promise.all([client.current.read(file, own.signal), loadAi()]);
    } catch (error) {
      // A newer file took over (nothing to show), the read took too long (the read sentence), or
      // the worker or the AI layer would not load (13's load sentence): the next file tries again.
      if (own.signal.aborted) return;
      reading.current = null;
      setImageLines([isTimeout(error) ? READ_FAILED : LOAD_FAILED_LINE]);
      return;
    }
    if (own.signal.aborted) return;
    reading.current = null;
    if (!reply.ok) {
      setImageLines([ERRORS[reply.error]]);
      return;
    }
    try {
      const palette = imagePalette(reply.clusters);
      const { patch } = ai.imageChange(palette);
      // Every line is built before the change commits, so a failure while building changes nothing.
      const lines = [seedsLine(palette), ai.madeWith({ provider: "rules" }, "vibe")];
      store.getState().applyAi({ patch, createdWith: "controls" });
      setHeld({ palette, jpeg: reply.jpeg });
      setImageLines(lines);
    } catch (error) {
      // A defect, not a refusal: the section never shows a raw error (I-M2-03).
      setImageLines([LOAD_FAILED_LINE]);
      reportError(error);
    }
  }

  const take = (files: FileList | null): void => {
    const file = files?.[0];
    if (file !== undefined) void extract(file);
  };

  /** Whether a drag carries files: only then does the zone take it. */
  const carriesFiles = (event: DragEvent<HTMLElement>): boolean =>
    [...event.dataTransfer.types].includes("Files");

  const lines = shown === "vibe" ? vibe.lines : asLines(imageLines);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop is a pointer gesture; the file input inside the zone is the keyboard's way to the same action. */}
      <div
        data-drop-zone=""
        data-over={over ? "" : undefined}
        onDragEnter={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          setOver(false);
          const { files } = event.dataTransfer;
          // The input shows the dropped file's name, as if it had been chosen.
          if (input.current !== null && files.length > 0) input.current.files = files;
          take(files);
        }}
        className="space-y-2 rounded-md border border-control-edge border-dashed px-3 py-3 data-over:border-foreground data-over:bg-panel"
      >
        <p className="text-fg-muted text-xs">{ZONE_TEXT}</p>
        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          aria-label={INPUT_LABEL}
          onChange={(event) => take(event.currentTarget.files)}
          className="block w-full min-w-0 cursor-pointer rounded-md border border-control-edge bg-page p-0.5 pr-2 text-fg-muted text-xs hover:border-fg-muted file:mr-3 file:min-h-8 file:cursor-pointer file:rounded-[5px] file:border-0 file:bg-border file:px-3 file:text-foreground file:text-sm"
        />
      </div>
      {held !== null && (
        <ul aria-label={LIST_LABEL} className="space-y-1">
          {held.palette.clusters.map((cluster) => (
            <li
              key={cluster.id}
              className="flex items-center gap-2 font-mono text-foreground text-xs tabular-nums"
            >
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded-sm border border-control-edge"
                style={{ backgroundColor: cluster.hex }}
              />
              {`${cluster.hex} · ${Math.round(cluster.share * 100)}%`}
            </li>
          ))}
        </ul>
      )}
      <ActionButton
        action={vibe}
        label="Read the vibe"
        busyLabel="Reading the vibe…"
        reason={vibeReason(held)}
        description={PRIVACY}
        onRun={() => {
          if (held === null || held.jpeg === null) return;
          const image = { palette: held.palette, jpeg: held.jpeg };
          setShown("vibe");
          vibe.run(async (ai, signal) => {
            const done = await readVibe(ai, { store, activity, image, signal });
            // A refused file while the vibe read showed its message; the vibe's lines come back.
            // A vibe a new image canceled stays hidden behind that image's lines.
            if (!signal.aborted) setShown("vibe");
            return done;
          });
        }}
      />
      <ActionStatus lines={lines} />
    </>
  );
}
