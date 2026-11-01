import { type DirectionParams, generateSystem } from "@/engine";
import { type DesignSpec, DesignSpecSchema } from "@/spec";
import { describeType, isRecord } from "./guards";

// The worker protocol (spec R2-13 item 2): a request carries an id, the resolved parameters and a
// seed; the reply echoes the id with a spec or an error. `runGenerate` holds all the logic, so the
// worker file only wires `message` to it and the logic is unit-tested here.

export type GenerateRequest = {
  readonly id: number;
  readonly params: DirectionParams;
  readonly seed: string;
};

export type GenerateReply =
  | { readonly id: number; readonly ok: true; readonly spec: DesignSpec }
  | { readonly id: number; readonly ok: false; readonly error: GenerateError };

/** An error as it crosses the worker boundary: its class name and message, no stack. */
export type GenerateError = { readonly name: string; readonly message: string };

/** Whether `value` can be a request id: the store numbers requests 1, 2, 3 (R2-13 item 3). */
const isRequestId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

function errorOf(error: unknown): GenerateError {
  if (error instanceof Error) return { name: error.name, message: error.message };
  let message: string;
  try {
    message = String(error);
  } catch {
    message = "an unprintable value was thrown";
  }
  return { name: "Error", message };
}

/** The request's id, or 0, which the store never issues, when the request has none. */
function idOf(request: unknown): number {
  return isRecord(request) && isRequestId(request.id) ? request.id : 0;
}

function checkRequest(request: unknown): void {
  if (!isRecord(request)) {
    throw new TypeError(`runGenerate: request must be an object, got ${describeType(request)}`);
  }
  const { id } = request;
  if (typeof id !== "number") {
    throw new TypeError(`runGenerate: request.id must be a number, got ${describeType(id)}`);
  }
  if (!isRequestId(id)) {
    throw new RangeError(`runGenerate: request.id must be a positive integer, got ${id}`);
  }
}

/**
 * `generateSystem(request.params, request.seed)` as a reply that echoes the request's id. It never
 * throws: a generator error, or a request that is not one, becomes `{ ok: false, error }`. A request
 * without a readable id is answered with id 0, which no store applies.
 */
export function runGenerate(request: GenerateRequest): GenerateReply {
  const id = idOf(request);
  try {
    checkRequest(request);
    return { id, ok: true, spec: generateSystem(request.params, request.seed) };
  } catch (error) {
    return { id, ok: false, error: errorOf(error) };
  }
}

const malformed = (id: number, detail: string): GenerateReply => ({
  id,
  ok: false,
  error: { name: "TypeError", message: `parseReply: ${detail}` },
});

/**
 * A message from the worker, parsed (it arrives as `unknown`). A reply whose id cannot be read
 * gives null. A readable id with a spec that fails `DesignSpecSchema`, or with neither a spec nor
 * an error, becomes an error reply with that id, so the request it answers still ends.
 */
export function parseReply(data: unknown): GenerateReply | null {
  if (!isRecord(data) || !isRequestId(data.id)) return null;
  const { id, ok, spec, error } = data;
  if (ok === true) {
    const parsed = DesignSpecSchema.safeParse(spec);
    return parsed.success
      ? { id, ok: true, spec: parsed.data }
      : malformed(id, "the reply's spec does not match dyelot.spec/1");
  }
  if (
    ok === false &&
    isRecord(error) &&
    typeof error.name === "string" &&
    typeof error.message === "string"
  ) {
    return { id, ok: false, error: { name: error.name, message: error.message } };
  }
  return malformed(id, "the reply holds neither a spec nor an error");
}
