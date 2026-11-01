/** The longest stretch of the input that an error message quotes. */
const QUOTED_LENGTH = 80;

/** The first 80 code points of `input`, with an ellipsis when more follow. */
function quote(input: string): string {
  let shown = "";
  let count = 0;
  // Iterating a string yields code points, so a quote never ends in half of a surrogate pair.
  for (const character of input) {
    if (count === QUOTED_LENGTH) return `${shown}…`;
    shown += character;
    count++;
  }
  return shown;
}

/**
 * `parseColor` and `hexToRgb` throw this for text that is not a color. `input` keeps the whole
 * argument, untrimmed. The message quotes at most its first 80 characters (code points) and says
 * what to write.
 */
export class ColorParseError extends Error {
  readonly input: string;

  constructor(input: string, reason = "Use #rgb, #rrggbb, rgb(r g b) or oklch(L C H).") {
    super(`Cannot parse "${quote(input)}" as a color. ${reason}`);
    this.name = "ColorParseError";
    this.input = input;
  }
}
