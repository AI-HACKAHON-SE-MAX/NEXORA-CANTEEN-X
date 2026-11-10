import { NextResponse } from "next/server";
import { respond } from "@/lib/errors";
import { originCheck, staffCookieName, staffCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(staffCookieName, "", staffCookieOptions(0));
    return response;
  } catch (error) {
    return respond(error);
  }
}
