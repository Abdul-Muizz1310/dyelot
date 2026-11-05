import { SITE } from "@/lib/site/config";
import { serverDeps } from "@/server/ai/deps";
import { handleAi } from "@/server/ai/handle";

// POST /api/ai/<feature> (docs/specs/04-ai.md, R4-15 and section 5.5): one action on dyelot's shared
// quota. Node.js is the default runtime, so no `runtime` export. maxDuration covers three tiers of
// 20 s, the 5 s guard read and two 2 s re-reads (R4-12).

export const maxDuration = 70;

export async function POST(
  request: Request,
  context: RouteContext<"/api/ai/[feature]">,
): Promise<Response> {
  return handleAi((await context.params).feature, request, serverDeps(SITE.url));
}
