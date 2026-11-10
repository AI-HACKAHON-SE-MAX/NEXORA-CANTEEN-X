import "server-only";
import { createHmac } from "node:crypto";
import { createSupabaseAdmin } from "./db/client";
import { getServerEnv } from "./config";
import { AppError } from "./errors";

export function getClientIp(request: Request): string {
  const firstForwardedIp = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return firstForwardedIp || "unknown";
}

export async function checkRateLimit(
  scope: string,
  identity: string,
  windowSeconds: number,
  max: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const { ID_HASH_SECRET } = getServerEnv();
  if (!/^[a-z-]{1,32}$/.test(scope)) throw new AppError("server_error");
  const identityHash = createHmac("sha256", ID_HASH_SECRET).update(identity).digest("hex");
  const key = `${scope}:${identityHash}`;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error || !Array.isArray(data) || typeof data[0]?.allowed !== "boolean") {
    throw new AppError("unavailable");
  }
  return {
    allowed: data[0].allowed,
    retryAfter: Math.max(1, Number(data[0].retry_after) || 1),
  };
}
