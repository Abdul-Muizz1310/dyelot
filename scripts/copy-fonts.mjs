// Copies the self-hosted canvas fonts from the installed Fontsource packages into
// `public/fonts/<id>/` (git-ignored), with the OFL text (spec R2-03 items 4 and 5).
//   variable family (@fontsource-variable/<id>): <id>-latin-wght-normal.woff2
//   static family (@fontsource/<id>):             <id>-latin-400-normal.woff2, and -700- when it has one
// The families are the Fontsource devDependencies of package.json; a test ties them to the
// catalog. Run by `predev` and `prebuild`; `--out <dir>` redirects the output for tests.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`copy-fonts: ${message}`);
  process.exit(1);
}

function outputDir(argv) {
  const at = argv.indexOf("--out");
  if (at === -1) return path.join(root, "public", "fonts");
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) fail("--out needs a directory");
  return path.resolve(value);
}

const out = outputDir(process.argv.slice(2));
const { devDependencies = {} } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const packages = Object.keys(devDependencies).filter(
  (name) => name.startsWith("@fontsource/") || name.startsWith("@fontsource-variable/"),
);
if (packages.length === 0) fail("package.json lists no @fontsource packages");

for (const name of packages) {
  const [scope, id] = name.split("/");
  const isVariable = scope === "@fontsource-variable";
  const dir = path.join(root, "node_modules", scope, id);
  if (!existsSync(path.join(dir, "metadata.json"))) {
    fail(`${id}: package ${name} is not installed (run pnpm install)`);
  }
  let faces;
  if (isVariable) {
    faces = [`${id}-latin-wght-normal.woff2`];
  } else {
    const { weights } = JSON.parse(readFileSync(path.join(dir, "metadata.json"), "utf8"));
    faces = [400, 700]
      .filter((w) => weights.includes(w))
      .map((w) => `${id}-latin-${w}-normal.woff2`);
  }
  const target = path.join(out, id);
  mkdirSync(target, { recursive: true });
  for (const face of faces) {
    const from = path.join(dir, "files", face);
    if (!existsSync(from)) fail(`${id}: ${name} has no file ${face}`);
    copyFileSync(from, path.join(target, face));
  }
  const license = path.join(dir, "LICENSE");
  if (!existsSync(license)) fail(`${id}: ${name} has no LICENSE`);
  copyFileSync(license, path.join(target, "OFL.txt"));
}

console.log(`copy-fonts: ${packages.length} families copied to ${out}`);
