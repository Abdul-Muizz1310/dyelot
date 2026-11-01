/** The longest stretch of the input that an error message quotes. */
const QUOTED_LENGTH = 80;

/**
 * `parseColor` and `hexToRgb` throw this for text that is not a color. `input` keeps the whole
 * argument, untrimmed. The message quotes at most its first 80 characters and says what to write.
 */
export class ColorParseError extends Error {
  readonly input: string;

  constructor(input: string, reason = "Use #rgb, #rrggbb, rgb(r g b) or oklch(L C H).") {
    const shown = input.length > QUOTED_LENGTH ? `${input.slice(0, QUOTED_LENGTH)}…` : input;
    super(`Cannot parse "${shown}" as a color. ${reason}`);
    this.name = "ColorParseError";
    this.input = input;
  }
}
