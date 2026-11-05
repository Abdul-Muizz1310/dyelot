// Module hooks for the e2e files that import `@/export` in Node (spec 10.12). The checker's source
// is imported as `./dyelot-check.mjs?raw`: Vitest and Turbopack read that as the file's text, but
// Playwright drops the query and loads the file as a module with no default export. These
// in-thread hooks run before Playwright's own and give the query its meaning.

import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const RAW = "?raw";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.endsWith(RAW)) return nextResolve(specifier, context);
    const resolved = nextResolve(specifier.slice(0, -RAW.length), context);
    return { ...resolved, url: `${resolved.url}${RAW}`, shortCircuit: true };
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(RAW)) return nextLoad(url, context);
    const text = readFileSync(fileURLToPath(url.slice(0, -RAW.length)), "utf8");
    return {
      format: "module",
      source: `export default ${JSON.stringify(text)};`,
      shortCircuit: true,
    };
  },
});
