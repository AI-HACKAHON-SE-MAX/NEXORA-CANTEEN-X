import { NextResponse } from "next/server";
import { AppError, respond } from "@/lib/errors";
import { originCheck } from "@/lib/session";
import { revokeStudentDevice, studentDeviceCookieName, studentDeviceCookieOptions } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    await revokeStudentDevice(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(studentDeviceCookieName(), "", studentDeviceCookieOptions(0));
    return response;
  } catch (error) {
    return respond(error);
  }
}
