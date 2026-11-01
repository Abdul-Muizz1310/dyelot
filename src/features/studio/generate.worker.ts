import { runGenerate } from "./protocol";

// The generator's Web Worker (spec R2-13 item 2): a thin shell that answers each request with
// `runGenerate`'s reply, which echoes the request id. All logic lives in protocol.ts.

addEventListener("message", (event) => {
  postMessage(runGenerate(event.data));
});
