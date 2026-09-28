import type { ZodError } from "zod";

/**
 * Public API v1 response envelope. Every response body has the same shape:
 *
 *   success: { "data": <payload>, "error": null, ["pagination": {...}] }
 *   failure: { "data": null, "error": { "code", "message", ["details"] } }
 *
 * Messages are safe for API consumers: no stack traces, no internals.
 */

export const ERROR_CODES = {
  validation_error: 400,
  invalid_json: 400,
  unauthorized: 401,
  key_revoked: 401,
  not_found: 404,
  invalid_state: 409,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ErrorDetail {
  path: string;
  message: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

/** Throw inside a v1 handler to produce a typed error response. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

const BASE_HEADERS = { "Cache-Control": "no-store" } as const;

export function ok(
  data: unknown,
  init: { status?: number; pagination?: Pagination; headers?: Record<string, string> } = {},
): Response {
  const body: Record<string, unknown> = { data, error: null };
  if (init.pagination) body.pagination = init.pagination;
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, ...init.headers },
  });
}

export function fail(
  code: ErrorCode,
  message: string,
  opts: { details?: ErrorDetail[]; headers?: Record<string, string> } = {},
): Response {
  const error: Record<string, unknown> = { code, message };
  if (opts.details?.length) error.details = opts.details;
  return Response.json(
    { data: null, error },
    { status: ERROR_CODES[code], headers: { ...BASE_HEADERS, ...opts.headers } },
  );
}

/** Zod issues → flat, documented `details` array ("line_items.0.quantity"). */
export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

export function validationError(error: ZodError, message = "Request validation failed."): ApiError {
  return new ApiError("validation_error", message, zodDetails(error));
}

/**
 * Map service-layer errors (plain Error messages from lib/services) onto API
 * errors. Unknown errors become a generic 500; the caller logs them.
 */
export function mapServiceError(e: unknown): ApiError | null {
  if (e instanceof ApiError) return e;
  const msg = e instanceof Error ? e.message : "";
  if (/^invoice not found|^buyer not found|^business not found/i.test(msg)) {
    const entity = msg.split(" ")[0]!.toLowerCase();
    return new ApiError("not_found", `No ${entity} with that id exists for this business.`);
  }
  if (/not sendable in status|cannot finalize invoice in status/i.test(msg)) {
    const status = /status (\w+)/.exec(msg)?.[1];
    return new ApiError(
      "invalid_state",
      status
        ? `This invoice cannot be sent while its status is "${status}".`
        : "This invoice cannot be sent in its current status.",
    );
  }
  if (/unsupported currency|must be positive/i.test(msg)) {
    return new ApiError("validation_error", msg);
  }
  if (/^payaza|payment link/i.test(msg)) {
    return new ApiError("upstream_error", "The payment provider did not respond as expected. Try again shortly.");
  }
  return null;
}

export function toErrorResponse(e: unknown, headers?: Record<string, string>): Response {
  const mapped = mapServiceError(e);
  if (mapped) return fail(mapped.code, mapped.message, { details: mapped.details, headers });
  return fail("internal_error", "Something went wrong on our side. Please try again.", { headers });
}
