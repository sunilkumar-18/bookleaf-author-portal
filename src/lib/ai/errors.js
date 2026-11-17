/** Thrown when the AI could not produce a usable result. Callers fall back. */
export class AiUnavailableError extends Error {
  constructor(reason, cause) {
    super(reason);
    this.reason = reason;
    this.cause = cause;
  }
}
