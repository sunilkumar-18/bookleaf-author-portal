// Anthropic (Claude) adapter: turns a provider-neutral request into a
// Messages API call. Server-only — reads ANTHROPIC_API_KEY from the environment.
import Anthropic from "@anthropic-ai/sdk";
import { AiUnavailableError } from "../errors";

export const name = "anthropic";
export const defaultModel = "claude-haiku-5-5";

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function model() {
  // AI_MODEL is the older name for this setting; still honoured.
  return process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || defaultModel;
}

let client = null;
function getClient() {
  // maxRetries: the SDK retries 408/409/429/5xx and connection errors with
  // exponential backoff (honouring retry-after). Kept small so a degraded API
  // fails fast into our fallback instead of hanging the request.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

/** @param {import("../client").AiRequest} req */
export async function generate(req) {
  try {
    const response = await getClient().messages.create(
      {
        model: model(),
        max_tokens: req.maxTokens,
        // Stable blocks first; `cache: true` marks the end of the cacheable prefix.
        system: req.system.map((block) => ({
          type: "text",
          text: block.text,
          ...(block.cache && { cache_control: { type: "ephemeral" } }),
        })),
        messages: [{ role: "user", content: req.user }],
        ...(req.reasoning === false && { thinking: { type: "disabled" } }),
        output_config: {
          effort: req.effort,
          ...(req.jsonSchema && { format: { type: "json_schema", schema: req.jsonSchema } }),
        },
      },
      { timeout: req.timeoutMs },
    );

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      finish: response.stop_reason === "refusal" ? "refusal" : response.stop_reason === "max_tokens" ? "max_tokens" : "ok",
      usage: {
        inputTokens:
          (response.usage?.input_tokens ?? 0) +
          (response.usage?.cache_read_input_tokens ?? 0) +
          (response.usage?.cache_creation_input_tokens ?? 0),
        cachedTokens: response.usage?.cache_read_input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    throw new AiUnavailableError(describeError(err), err);
  }
}

function describeError(err) {
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by AI provider";
  if (err instanceof Anthropic.AuthenticationError) return "AI API key is invalid";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "AI request timed out";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach AI provider";
  if (err instanceof Anthropic.APIError) return `AI provider error (${err.status})`;
  return "Unexpected AI error";
}
