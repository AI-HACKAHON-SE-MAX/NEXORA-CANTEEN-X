import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError, respond } from "@/lib/errors";
import { originCheck } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { createDemoChallenge, demoChallengeCookieName, demoCookieOptions, DEMO_CHALLENGE_MAX_AGE, demoUniversityIdHash } from "@/lib/demo-student";
import { readJson } from "@/lib/request";
import { studentAuthStartSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const parsed = studentAuthStartSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation_error");
    const { universityId, email, customerName } = parsed.data;
    const identityHash = demoUniversityIdHash(universityId);
    const limits = await Promise.all([
      checkRateLimit("demo-otp-ip", getClientIp(request), 10 * 60, 10),
      checkRateLimit("demo-otp-id", identityHash, 10 * 60, 5),
      checkRateLimit("demo-otp-email", email, 10 * 60, 5),
    ]);
    const retryAfter = Math.max(...limits.map((limit) => limit.retryAfter));
    if (limits.some((limit) => !limit.allowed)) throw new AppError("rate_limited", { retryAfterSeconds: retryAfter });

    const demoCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const challenge = await createDemoChallenge({ universityId, email, customerName, code: demoCode });
    const response = NextResponse.json({ ok: true, demoCode, message: "Temporary demo verification code. No email is sent." }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(demoChallengeCookieName, challenge, demoCookieOptions(DEMO_CHALLENGE_MAX_AGE));
    return response;
  } catch (error) {
    return respond(error);
  }
}
