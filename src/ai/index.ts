// The AI entry (R4-04, section 5.2 of docs/specs/04-ai.md): only `export … from` lines. App code
// reaches it through `import()`, or with a type-only import. Later tasks add the rest of 5.2's
// runtime names with their modules (chat, cache key, prompts, lexicon, colors, refine, image, PKCE).

export type { AiChange, AiPatch } from "./apply";
export { briefChange, imageChange, rationaleChange, refineChange, vibeChange } from "./apply";
export { cacheKey } from "./cache-key";
export type { Tier, TierName } from "./cascade";
export { cascadePlan, isFreeSlug } from "./cascade";
export type {
  ChatPart,
  ChatRequest,
  ChatResponse,
  FailureKind,
  TierOutcome,
  Usage,
} from "./chat";
export { buildChatRequest, chatMessages, OPENROUTER_ORIGIN, readReply } from "./chat";
export { briefColors } from "./colors";
export type { CapCookie } from "./cookie";
export {
  CAP_COOKIE,
  capMacInput,
  capSetCookie,
  formatCapCookie,
  parseCapCookie,
  VISITOR_CAP,
} from "./cookie";
export type { ProviderFailure } from "./copy";
export { failureSentence, madeWith, providerLabel } from "./copy";
export type {
  AiFeature,
  BriefDraft,
  BriefInput,
  BriefOutput,
  ChromaLevel,
  CritiqueInput,
  CritiqueOutput,
  FeatureInput,
  FeatureOutput,
  Hue,
  HueOrNull,
  MoodTag,
  NeutralTint,
  RationaleInput,
  RationaleOutput,
  RefineInput,
  RefineOp,
  RefineOpName,
  RefineOutput,
  TypeVibe,
  VibeInput,
  VibeOutput,
} from "./features";
export {
  AI_FEATURES,
  inputSchema,
  outputJsonSchema,
  outputSchema,
  parseOutput,
} from "./features";
export { guardVerdict, readKeyRemaining } from "./guard";
export { briefInput, critiqueInput, rationaleInput, refineInput, vibeInput } from "./inputs";
export type { LexiconCategory, LexiconEntry, LexiconMatch } from "./lexicon/match";
export { matchLexicon } from "./lexicon/match";
export { authorizeUrl, base64url, readCallback } from "./pkce";
export type { PromptFile } from "./prompts";
export { PROMPTS } from "./prompts";
export type { AiPath, RouteCode, RouteReply } from "./route-reply";
export { ROUTE_CODES, readRouteReply } from "./route-reply";
