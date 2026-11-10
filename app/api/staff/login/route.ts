import { NextResponse } from "next/server";
import { PIN_RATE } from "@/lib/config-values";
import { getServerEnv } from "@/lib/config";
import { verifyStaffPin } from "@/lib/crypto";
import { AppError, respond } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { readJson } from "@/lib/request";
import { originCheck, signSession, staffCookieName, staffCookieOptions } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation_error");

    const ipLimit = await checkRateLimit("pin-ip", getClientIp(request), PIN_RATE.windowSeconds, PIN_RATE.perIp);
    const globalLimit = await checkRateLimit("pin-global", "all", PIN_RATE.windowSeconds, PIN_RATE.global);
    if (!ipLimit.allowed || !globalLimit.allowed) {
      throw new AppError("rate_limited", {
        retryAfterSeconds: Math.max(ipLimit.retryAfter, globalLimit.retryAfter),
      });
    }

    const { STAFF_PIN_SALT, STAFF_PIN_HASH } = getServerEnv();
    if (!(await verifyStaffPin(parsed.data.pin, STAFF_PIN_SALT, STAFF_PIN_HASH))) {
      throw new AppError("unauthorized");
    }

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(staffCookieName, await signSession(), staffCookieOptions());
    return response;
  } catch (error) {
    return respond(error);
  }
}
