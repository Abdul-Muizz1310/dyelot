import { SITE } from "@/lib/site/config";
import { serverDeps } from "@/server/ai/deps";
import { handleModels } from "@/server/ai/handle";

// GET /api/ai/models (docs/specs/04-ai.md, R4-21 and section 5.5): the free slugs the shared route
// would try, which the visitor key uses too. A static segment, so it wins over [feature].

export async function GET(): Promise<Response> {
  return handleModels(serverDeps(SITE.url));
}
