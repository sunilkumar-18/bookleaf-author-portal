// Provider-neutral AI client: one place for provider selection, the circuit
// breaker, refusal/truncation handling and usage logging. Callers describe
// *what* they need (an AiRequest); adapters in ./providers translate it for
// Anthropic or Gemini. API keys are read from the server environment only —
// this module is never imported by client components.
import { prisma } from "@/lib/db";
import { AiUnavailableError } from "./errors";
import * as anthropic from "./providers/anthropic";
import * as gemini from "./providers/gemini";

export { AiUnavailableError };

/**
 * @typedef {object} AiRequest
 * @property {{ text: string, cache?: boolean }[]} system  Stable instructions first; `cache` marks the end of the cacheable prefix
 * @property {string} user          The per-request content
 * @property {number} maxTokens
 * @property {number} timeoutMs
 * @property {"low"|"medium"|"high"} effort
 * @property {false} [reasoning]    false = skip extended reasoning (simple tasks)
 * @property {object} [jsonSchema]  Constrain the output to this JSON Schema
 */

const PROVIDERS = { anthropic, gemini };

/**
 * The active provider: AI_PROVIDER if set, otherwise the first one with a key
 * (Anthropic, then Gemini). Null when no AI is configured.
 */
function activeProvider() {
  const forced = PROVIDERS[process.env.AI_PROVIDER?.toLowerCase()];
  if (forced) return forced.isConfigured() ? forced : null;
  return [anthropic, gemini].find((p) => p.isConfigured()) ?? null;
}

// --- Circuit breaker -------------------------------------------------------
// After repeated failures, skip AI calls for a cool-down period so that an
// outage doesn't add timeout latency to every ticket. In-memory per server
// instance — good enough here; a shared store (Redis) would be the production version.
const breaker = { failures: 0, openUntil: 0 };
const FAILURE_THRESHOLD = 3;
const COOL_DOWN_MS = 60_000;

export function aiAvailability() {
  const provider = activeProvider();
  if (!provider) return { available: false, reason: "AI is not configured (no API key)" };
  if (Date.now() < breaker.openUntil) return { available: false, reason: "AI temporarily paused after repeated errors" };
  return { available: true, provider: provider.name, model: provider.model() };
}

/**
 * Run one model call and return its text.
 * Every call (success or failure) is written to AiLog with token usage + latency.
 * @param {AiRequest & { task: string, ticketId?: string }} request
 */
export async function callModel({ task, ticketId, ...req }) {
  const availability = aiAvailability();
  if (!availability.available) throw new AiUnavailableError(availability.reason);

  const provider = activeProvider();
  const model = provider.model();
  const started = Date.now();
  try {
    const result = await provider.generate(req);

    if (result.finish === "refusal") throw new AiUnavailableError("Model declined to respond");
    if (result.finish === "max_tokens") throw new AiUnavailableError("Model response was cut off");
    const text = result.text.trim();
    if (!text) throw new AiUnavailableError("Model returned an empty response");

    breaker.failures = 0;
    await logUsage({ task, ticketId, model, started, success: true, usage: result.usage });
    return text;
  } catch (err) {
    breaker.failures += 1;
    if (breaker.failures >= FAILURE_THRESHOLD) {
      breaker.openUntil = Date.now() + COOL_DOWN_MS;
      breaker.failures = 0;
    }
    const reason = err instanceof AiUnavailableError ? err.reason : "Unexpected AI error";
    await logUsage({ task, ticketId, model, started, success: false, error: reason });
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError(reason, err);
  }
}

async function logUsage({ task, ticketId, model, started, success, usage, error }) {
  try {
    await prisma.aiLog.create({
      data: {
        task,
        ticketId: ticketId ?? null,
        model,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        latencyMs: Date.now() - started,
        success,
        error: error ?? null,
      },
    });
  } catch (logErr) {
    // Logging must never break the main flow.
    console.error("[ai] failed to write AiLog:", logErr.message);
  }
}

/** Parse a JSON object out of model text (structured outputs should give pure JSON; be tolerant anyway). */
export function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/** Trim long free text before sending it to the model (cost control). */
export function clip(text, maxChars) {
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[...truncated]` : text;
}
