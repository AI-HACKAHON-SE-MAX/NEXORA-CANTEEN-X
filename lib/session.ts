import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { SESSION_HOURS } from "./config-values";
import { getServerEnv } from "./config";
import { AppError } from "./errors";

const COOKIE_NAME = "canteenx_staff";

function sessionSecret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().SESSION_SECRET);
}

export async function signSession(now = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: "staff" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_HOURS * 60 * 60)
    .sign(sessionSecret());
}

export async function verifySession(token: string, now = new Date()): Promise<boolean> {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    return protectedHeader.alg === "HS256" && payload.role === "staff";
  } catch {
    return false;
  }
}

export async function requireStaff(request: Request): Promise<void> {
  const rawCookie = request.headers.get("cookie") ?? "";
  const token = rawCookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token || !(await verifySession(token))) throw new AppError("unauthorized");
}

export const staffCookieName = COOKIE_NAME;

export function staffCookieOptions(maxAge = SESSION_HOURS * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function originCheck(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new AppError("unauthorized");
  try {
    if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
      throw new AppError("unauthorized");
    }
  } catch {
    throw new AppError("unauthorized");
  }
}
