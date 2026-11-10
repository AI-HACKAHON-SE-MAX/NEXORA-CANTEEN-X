import { NextResponse } from "next/server";
import { AppError, respond } from "@/lib/errors";
import { originCheck } from "@/lib/session";
import { revokeStudentDevice, studentDeviceCookieName, studentDeviceCookieOptions } from "@/lib/student-auth";
import { demoChallengeCookieName, demoCookieOptions, demoStudentCookieName } from "@/lib/demo-student";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    if (new URL(request.url).searchParams.get("mode") === "demo") {
      response.cookies.set(demoStudentCookieName, "", demoCookieOptions(0));
      response.cookies.set(demoChallengeCookieName, "", demoCookieOptions(0));
    } else {
      await revokeStudentDevice(request);
      response.cookies.set(studentDeviceCookieName(), "", studentDeviceCookieOptions(0));
    }
    return response;
  } catch (error) {
    return respond(error);
  }
}
