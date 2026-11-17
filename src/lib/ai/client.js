// Thin wrapper around the Anthropic SDK: one place for the model choice,
// timeouts/retries, a circuit breaker, refusal handling and usage logging.
// The API key is read from the server environment only — this module is never
// imported by client components.
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export const AI_MODEL = process.env.AI_MODEL || "claude-haiku-5-5";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // maxRetries: the SDK already retries 408/409/429/5xx and connection errors
  // with exponential backoff (honouring retry-after). We keep that small so a
  // degraded API fails fast into our fallback instead of hanging the request.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

/** Thrown when the AI could not produce a usable result. Callers fall back. */
export class AiUnavailableError extends Error {
  constructor(reason, cause) {
    super(reason);
    this.reason = reason;
    this.cause = cause;
  }
}

// --- Circuit breaker -------------------------------------------------------
// After repeated failures, skip AI calls for a cool-down period so that an
// outage doesn't add timeout latency to every ticket. In-memory per server
// instance — good enough here; a shared store (Redis) would be the production version.
const breaker = { failures: 0, openUntil: 0 };
const FAILURE_THRESHOLD = 3;
const COOL_DOWN_MS = 60_000;

export function aiAvailability() {
  if (!process.env.ANTHROPIC_API_KEY) return { available: false, reason: "AI is not configured (no API key)" };
  if (Date.now() < breaker.openUntil) return { available: false, reason: "AI temporarily paused after repeated errors" };
  return { available: true };
}

/**
 * Call the Messages API and return the text of the response.
 * Every call (success or failure) is written to AiLog with token usage + latency.
 */
export async function callModel({ task, ticketId, timeoutMs, ...params }) {
  const availability = aiAvailability();
  if (!availability.available) throw new AiUnavailableError(availability.reason);

  const started = Date.now();
  try {
    const response = await getClient().messages.create(
      { model: AI_MODEL, ...params },
      { timeout: timeoutMs },
    );

    if (response.stop_reason === "refusal") {
      throw new AiUnavailableError("Model declined to respond");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiUnavailableError("Model response was cut off");
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new AiUnavailableError("Model returned an empty response");

    breaker.failures = 0;
    await logUsage({ task, ticketId, started, success: true, usage: response.usage });
    return text;
  } catch (err) {
    breaker.failures += 1;
    if (breaker.failures >= FAILURE_THRESHOLD) {
      breaker.openUntil = Date.now() + COOL_DOWN_MS;
      breaker.failures = 0;
    }
    const reason = describeError(err);
    await logUsage({ task, ticketId, started, success: false, error: reason });
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError(reason, err);
  }
}

function describeError(err) {
  if (err instanceof AiUnavailableError) return err.reason;
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by AI provider";
  if (err instanceof Anthropic.AuthenticationError) return "AI API key is invalid";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "AI request timed out";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach AI provider";
  if (err instanceof Anthropic.APIError) return `AI provider error (${err.status})`;
  return "Unexpected AI error";
}

async function logUsage({ task, ticketId, started, success, usage, error }) {
  try {
    await prisma.aiLog.create({
      data: {
        task,
        ticketId: ticketId ?? null,
        model: AI_MODEL,
        inputTokens:
          (usage?.input_tokens ?? 0) +
          (usage?.cache_read_input_tokens ?? 0) +
          (usage?.cache_creation_input_tokens ?? 0),
        outputTokens: usage?.output_tokens ?? 0,
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
