import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import draft7 from "ajv/dist/refs/json-schema-draft-07.json";
import addFormats from "ajv-formats";

// The vendored schemas of tests/fixtures/schemas/ (sources.json names each URL, date and hash). No
// test fetches anything (R3-28).

const FIXTURES = path.join(process.cwd(), "tests/fixtures/schemas");

export function readSchemaFile(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

/**
 * A validator for shadcn's registry item schema. The schema declares `$schema` with an `https`
 * id, so the instance first adds Ajv's own draft-07 meta-schema under that id (C-REG-11).
 */
export function registryValidator(): (value: unknown) => boolean {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addMetaSchema({ ...draft7, $id: "https://json-schema.org/draft-07/schema#" });
  ajv.addSchema(JSON.parse(readSchemaFile("registry-item.json")), "shadcn-registry-item");
  const validate = ajv.getSchema("shadcn-registry-item");
  if (validate === undefined) throw new Error("registryValidator: the item schema did not compile");
  return (value) => validate(value) === true;
}
