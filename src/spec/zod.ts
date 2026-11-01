import { z } from "zod";

// zod 4 compiles object parsers with `new Function` unless told not to. The production CSP has
// no 'unsafe-eval', and a strict CSP reports even the probe that zod catches. Every schema
// imports z from here, so this line runs before any schema is built, which is when zod probes.
// Biome's noRestrictedImports keeps every other module from importing "zod" itself.
z.config({ jitless: true });

export { z };
