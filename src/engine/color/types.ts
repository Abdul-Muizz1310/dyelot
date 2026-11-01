/**
 * A color in OKLCH. `h: null` is CSS `none`: the color has no hue, because its chroma is at or
 * below 4e-6 (spec R-03).
 */
export type Oklch = {
  readonly l: number;
  readonly c: number;
  readonly h: number | null;
};

/** A color in OKLab: lightness, then the green-red axis `a` and the blue-yellow axis `b`. */
export type Oklab = readonly [l: number, a: number, b: number];

/**
 * Gamma-encoded channels, 0 to 1 when the color is in gamut. A `Gamut` argument says which
 * space the channels belong to.
 */
export type Rgb = readonly [number, number, number];

/** The RGB space of a conversion: sRGB, or Display P3, whose gamut is wider. */
export type Gamut = "srgb" | "p3";

export type Mode = "light" | "dark";

/** `#rrggbb` in lowercase. Only `toHex` and the schema make one (spec R-05). */
export type Hex = string & { readonly __hex: true };
