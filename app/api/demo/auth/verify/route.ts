import { NextResponse } from "next/server";
import { AppError, respond } from "@/lib/errors";
import { originCheck } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import {
  createDemoStudentSession,
  demoChallengeCookieName,
  demoCookieOptions,
  demoStudentCookieName,
  DEMO_SESSION_MAX_AGE,
  getDemoStudentFromRequest,
  demoUniversityIdHash,
  verifyDemoChallenge,
} from "@/lib/demo-student";
import { readJson } from "@/lib/request";
import { studentAuthVerifySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const parsed = studentAuthVerifySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation_error");
    const idHash = demoUniversityIdHash(parsed.data.universityId);
    const limits = await Promise.all([
      checkRateLimit("demo-verify-ip", getClientIp(request), 10 * 60, 10),
      checkRateLimit("demo-verify-id", idHash, 10 * 60, 10),
    ]);
    const retryAfter = Math.max(...limits.map((limit) => limit.retryAfter));
    if (limits.some((limit) => !limit.allowed)) throw new AppError("rate_limited", { retryAfterSeconds: retryAfter });

    const student = await verifyDemoChallenge(request, parsed.data);
    const token = await createDemoStudentSession(student);
    const response = NextResponse.json({ ok: true, demo: true, student: { name: student.customerName, isDemo: true } }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(demoStudentCookieName, token, demoCookieOptions(DEMO_SESSION_MAX_AGE));
    response.cookies.set(demoChallengeCookieName, "", demoCookieOptions(0));
    return response;
  } catch (error) {
    return respond(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const student = await getDemoStudentFromRequest(request);
    return Response.json(student
      ? { authenticated: true, demo: true, student: { name: student.customer_name, isDemo: true } }
      : { authenticated: false, demo: true },
    { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error);
  }
}
