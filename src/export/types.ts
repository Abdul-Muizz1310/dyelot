import type { Summary } from "@/engine";
import type { DesignSpec } from "@/spec";

/** A file of the bundle (R3-09): a relative path and its text. */
export type BundleFile = { readonly path: string; readonly text: string };

/** One file of `receipt.json`'s `files` list (section 7.1): a path, its UTF-8 byte length and hash. */
export type ReceiptFile = {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
};

/** `receipt.json` parsed (section 7.1, R3-23). */
export type Receipt = {
  readonly format: string;
  readonly generator: {
    readonly name: string;
    readonly site: string;
    readonly engineVersion: string;
  };
  readonly design: Readonly<Record<string, unknown>>;
  readonly summary: Summary;
  readonly contrast: readonly Readonly<Record<string, unknown>>[];
  readonly separation: readonly Readonly<Record<string, unknown>>[];
  readonly gamut: Readonly<Record<string, unknown>>;
  readonly roles: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly radius: string;
  readonly findings: readonly Readonly<Record<string, unknown>>[];
  readonly files: readonly ReceiptFile[];
};

/** The input of `buildBundle` (section 5.3, R5-24): `flavor` adds the nine files of `flavor/`. */
export type BundleInput = {
  readonly spec: DesignSpec;
  readonly origin: string;
  readonly flavor?: boolean;
};

/** A built bundle (section 5.3, R3-12). */
export type Bundle = {
  readonly slug: string;
  readonly specId: string;
  readonly lot: string;
  readonly link: string;
  readonly files: readonly BundleFile[];
  readonly receipt: Receipt;
  readonly summary: Summary;
};
