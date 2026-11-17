// Google Gemini adapter: turns a provider-neutral request into a
// generateContent REST call. Server-only — reads GEMINI_API_KEY from the environment.
// Uses fetch directly (no extra SDK): one endpoint, a few fields.
import { AiUnavailableError } from "../errors";

export const name = "gemini";
// The "-latest" alias tracks Google's current Flash-Lite model: fast, cheap, and on the free tier.
export const defaultModel = "gemini-flash-lite-latest";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

export function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function model() {
  return process.env.GEMINI_MODEL || defaultModel;
}

/** @param {import("../client").AiRequest} req */
export async function generate(req) {
  const body = {
    // Gemini has one system instruction; our blocks are joined in order, so the
    // stable prefix stays stable and Gemini's implicit caching can reuse it.
    systemInstruction: { parts: [{ text: req.system.map((b) => b.text).join("\n\n") }] },
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      ...(req.jsonSchema && { responseMimeType: "application/json", responseSchema: toGeminiSchema(req.jsonSchema) }),
    },
  };

  const response = await postWithRetry(`${API_BASE}/${encodeURIComponent(model())}:generateContent`, body, req.timeoutMs);

  if (response.promptFeedback?.blockReason) return { text: "", finish: "refusal", usage: usageOf(response) };

  const candidate = response.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");

  return { text, finish: finishOf(candidate?.finishReason), usage: usageOf(response) };
}

/** POST with a per-attempt timeout; retries rate limits and 5xx with a short backoff. */
async function postWithRetry(url, body, timeoutMs) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason = err?.name === "TimeoutError" ? "AI request timed out" : "Could not reach AI provider";
      throw new AiUnavailableError(reason, err);
    }

    if (res.ok) return res.json();

    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
      await sleep(500 * 3 ** attempt); // 0.5 s, then 1.5 s
      continue;
    }
    throw new AiUnavailableError(describeStatus(res.status));
  }
}

function describeStatus(status) {
  if (status === 429) return "Rate limited by AI provider";
  if (status === 400 || status === 401 || status === 403) return `AI request rejected (${status}) — check the API key and model`;
  return `AI provider error (${status})`;
}

function finishOf(reason) {
  if (reason === "MAX_TOKENS") return "max_tokens";
  if (!reason || reason === "STOP") return "ok";
  return "refusal"; // SAFETY, RECITATION, BLOCKLIST, PROHIBITED_CONTENT, ...
}

function usageOf(response) {
  const u = response.usageMetadata ?? {};
  return {
    inputTokens: u.promptTokenCount ?? 0, // includes cached tokens
    cachedTokens: u.cachedContentTokenCount ?? 0,
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
}

/**
 * Gemini's responseSchema is an OpenAPI subset: upper-case type names and no
 * `additionalProperties`. Convert our standard JSON Schema to it.
 */
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (key === "type" && typeof value === "string") out.type = value.toUpperCase();
    else if (key === "properties") out.properties = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toGeminiSchema(v)]));
    else out[key] = toGeminiSchema(value);
  }
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
