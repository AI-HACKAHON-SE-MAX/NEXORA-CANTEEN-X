import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { AppError, respond } from "@/lib/errors";
import { originCheck } from "@/lib/session";
import { studentDeviceCookieName, studentDeviceCookieOptions, verifyStudentOtp } from "@/lib/student-auth";
import { getServerEnv } from "@/lib/config";
import { hmacUniversityId } from "@/lib/crypto";
import { readJson } from "@/lib/request";
import { studentAuthVerifySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const parsed = studentAuthVerifySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation_error");
    const idHash = hmacUniversityId(parsed.data.universityId, getServerEnv().ID_HASH_SECRET);
    const limits = await Promise.all([
      checkRateLimit("student-verify-ip", getClientIp(request), 10 * 60, 10),
      checkRateLimit("student-verify-id", idHash, 10 * 60, 10),
      checkRateLimit("student-verify-email", parsed.data.email, 10 * 60, 10),
    ]);
    const retryAfter = Math.max(...limits.map((limit) => limit.retryAfter));
    if (limits.some((limit) => !limit.allowed)) throw new AppError("rate_limited", { retryAfterSeconds: retryAfter });

    const { account, deviceToken } = await verifyStudentOtp(parsed.data);
    const response = NextResponse.json({ ok: true, student: { name: account.customer_name } }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(studentDeviceCookieName(), deviceToken, studentDeviceCookieOptions());
    return response;
  } catch (error) {
    return respond(error);
  }
}
