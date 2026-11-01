import "react";

// Custom properties in a React `style` object, typed: a key that starts with `--` takes a string.
// The studio's canvas frame carries the theme bridge's variables this way (spec section 7.4).
declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | undefined;
  }
}
