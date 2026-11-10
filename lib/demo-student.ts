import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getServerEnv } from "./config";
import { AppError } from "./errors";
import { hmacUniversityId, safeEqualHex } from "./crypto";
import type { StudentAccount } from "./student-auth";

const SESSION_COOKIE = "canteenx_demo_student";
const CHALLENGE_COOKIE = "canteenx_demo_challenge";
const DEMO_SESSION_SECONDS = 6 * 60 * 60;
const CHALLENGE_SECONDS = 5 * 60;

export function demoUniversityIdHash(universityId: string): string {
  const env = getServerEnv();
  return hmacUniversityId(`DEMO:${universityId}`, env.ID_HASH_SECRET);
}

function secret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().SESSION_SECRET);
}

function cookie(request: Request, name: string): string {
  return (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function codeHash(code: string): string {
  return createHmac("sha256", getServerEnv().SESSION_SECRET).update(`canteenx-demo-otp:${code}`).digest("hex");
}

export async function createDemoChallenge(input: {
  universityId: string;
  email: string;
  customerName: string;
  code: string;
}): Promise<string> {
  return new SignJWT({
    role: "demo-otp",
    universityIdHash: demoUniversityIdHash(input.universityId),
    email: input.email,
    customerName: input.customerName,
    otpHash: codeHash(input.code),
    nonce: randomBytes(12).toString("base64url"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_SECONDS}s`)
    .sign(secret());
}

export async function verifyDemoChallenge(request: Request, input: {
  universityId: string;
  email: string;
  code: string;
}): Promise<{ universityIdHash: string; email: string; customerName: string }> {
  const token = cookie(request, CHALLENGE_COOKIE);
  if (!token) throw new AppError("unauthorized");
  try {
    const { payload, protectedHeader } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const idHash = demoUniversityIdHash(input.universityId);
    if (protectedHeader.alg !== "HS256" || payload.role !== "demo-otp" ||
      payload.universityIdHash !== idHash || payload.email !== input.email ||
      typeof payload.customerName !== "string" || typeof payload.otpHash !== "string" ||
      !safeEqualHex(codeHash(input.code), payload.otpHash)) {
      throw new AppError("unauthorized");
    }
    return { universityIdHash: idHash, email: input.email, customerName: payload.customerName };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("unauthorized");
  }
}

export async function createDemoStudentSession(input: {
  universityIdHash: string;
  email: string;
  customerName: string;
}): Promise<string> {
  return new SignJWT({
    role: "demo-student",
    universityIdHash: input.universityIdHash,
    email: input.email,
    customerName: input.customerName,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${DEMO_SESSION_SECONDS}s`)
    .sign(secret());
}

export async function getDemoStudentFromRequest(request: Request): Promise<(StudentAccount & { is_demo: true }) | null> {
  const token = cookie(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (protectedHeader.alg !== "HS256" || payload.role !== "demo-student" ||
      typeof payload.universityIdHash !== "string" || !/^[a-f0-9]{64}$/.test(payload.universityIdHash) ||
      typeof payload.email !== "string" || typeof payload.customerName !== "string") return null;
    return {
      id: "demo-student",
      university_id_hash: payload.universityIdHash,
      email: payload.email,
      customer_name: payload.customerName,
      is_demo: true,
    };
  } catch {
    return null;
  }
}

export const demoStudentCookieName = SESSION_COOKIE;
export const demoChallengeCookieName = CHALLENGE_COOKIE;

export function demoCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export const DEMO_SESSION_MAX_AGE = DEMO_SESSION_SECONDS;
export const DEMO_CHALLENGE_MAX_AGE = CHALLENGE_SECONDS;
