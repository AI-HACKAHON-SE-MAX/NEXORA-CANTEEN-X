export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "not_found"
  | "active_order_limit"
  | "duplicate_submit"
  | "item_unavailable"
  | "invalid_transition"
  | "status_changed"
  | "payload_too_large"
  | "rate_limited"
  | "daily_limit"
  | "unavailable"
  | "server_error";

const statusByCode: Record<ErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  not_found: 404,
  active_order_limit: 409,
  duplicate_submit: 409,
  item_unavailable: 409,
  invalid_transition: 409,
  status_changed: 409,
  payload_too_large: 413,
  rate_limited: 429,
  daily_limit: 503,
  unavailable: 503,
  server_error: 500,
};

const safeMessages: Record<ErrorCode, string> = {
  validation_error: "Please check the information and try again.",
  unauthorized: "Please sign in to continue.",
  not_found: "We couldn't find that request.",
  active_order_limit: "You already have the maximum number of active orders.",
  duplicate_submit: "This order was already submitted.",
  item_unavailable: "One or more items are unavailable. Please update your cart.",
  invalid_transition: "That status change isn't allowed.",
  status_changed: "This order changed on another device. Refresh and try again.",
  payload_too_large: "The request is too large.",
  rate_limited: "Too many requests. Please wait and try again.",
  daily_limit: "The canteen has reached today's order limit. Please try again tomorrow.",
  unavailable: "The service is temporarily unavailable. Please try again.",
  server_error: "Something went wrong. Please try again.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly safeMessage: string;

  constructor(code: ErrorCode, options?: { retryAfterSeconds?: number; safeMessage?: string }) {
    super(safeMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.safeMessage = options?.safeMessage
      ? options.safeMessage.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").slice(0, 180)
      : safeMessages[code];
  }
}

export function respond(error: unknown): Response {
  const known = error instanceof AppError ? error : new AppError("server_error");
  if (!(error instanceof AppError)) {
    // Keep diagnostics free of request data, secrets, identifiers and stack traces.
    console.error("Unhandled application error");
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  if (known.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(known.retryAfterSeconds));
  }

  return Response.json(
    { error: { code: known.code, message: known.safeMessage } },
    { status: known.status, headers },
  );
}
