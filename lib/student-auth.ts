import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { createSupabaseAdmin } from "./db/client";
import { getServerEnv } from "./config";
import { AppError } from "./errors";
import { checkRateLimit, getClientIp } from "./ratelimit";
import { hmacUniversityId, safeEqualHex, sha256Hex } from "./crypto";

const DEVICE_COOKIE = "canteenx_student_device";
const DEVICE_DAYS = 180;

export type StudentAccount = {
  id: string;
  university_id_hash: string;
  email: string;
  customer_name: string;
};

function otpHash(idHash: string, email: string, code: string): string {
  const { ID_HASH_SECRET } = getServerEnv();
  return createHmac("sha256", ID_HASH_SECRET).update(`${idHash}:${email}:${code}`).digest("hex");
}

function cookieValue(request: Request): string {
  return (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${DEVICE_COOKIE}=`))?.slice(DEVICE_COOKIE.length + 1) ?? "";
}

export function studentDeviceCookieName(): string {
  return DEVICE_COOKIE;
}

export function studentDeviceCookieOptions(maxAge = DEVICE_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export async function sendStudentOtp(input: {
  request: Request;
  universityId: string;
  email: string;
  customerName: string;
}): Promise<void> {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY || !env.STUDENT_OTP_FROM) throw new AppError("unavailable");
  const idHash = hmacUniversityId(input.universityId, env.ID_HASH_SECRET);
  const ip = getClientIp(input.request);
  const limits = await Promise.all([
    checkRateLimit("student-otp-ip", ip, 10 * 60, 5),
    checkRateLimit("student-otp-id", idHash, 10 * 60, 5),
    checkRateLimit("student-otp-email", input.email, 10 * 60, 5),
  ]);
  const retryAfter = Math.max(...limits.map((limit) => limit.retryAfter));
  if (limits.some((limit) => !limit.allowed)) {
    throw new AppError("rate_limited", { retryAfterSeconds: retryAfter });
  }

  const supabase = createSupabaseAdmin();
  const [{ data: idOwner, error: idError }, { data: emailOwner, error: emailError }] = await Promise.all([
    supabase.from("student_accounts").select("email").eq("university_id_hash", idHash).maybeSingle(),
    supabase.from("student_accounts").select("university_id_hash").eq("email", input.email).maybeSingle(),
  ]);
  if (idError || emailError) throw new AppError("unavailable");
  // Keep responses indistinguishable when the submitted ID/email are already bound elsewhere.
  if ((idOwner && idOwner.email !== input.email) || (emailOwner && emailOwner.university_id_hash !== idHash)) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error: deleteError } = await supabase.from("student_email_otps")
    .delete().eq("university_id_hash", idHash).eq("email", input.email);
  if (deleteError) throw new AppError("unavailable");
  const { error: insertError } = await supabase.from("student_email_otps").insert({
    university_id_hash: idHash,
    email: input.email,
    customer_name: input.customerName,
    otp_hash: otpHash(idHash, input.email, code),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (insertError) throw new AppError("unavailable");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.STUDENT_OTP_FROM,
      to: [input.email],
      subject: "Your CanteenX verification code",
      text: `Your CanteenX code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#201b16"><p style="color:#b45309;font-weight:700">CANTEENX · CUI ISLAMABAD</p><h1 style="font-size:26px">Verify your student account</h1><p>Enter this code in CanteenX. It expires in 10 minutes.</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;background:#fff7ed;padding:18px;border-radius:16px">${code}</p><p style="color:#78716c">If you did not request this, you can ignore this email.</p></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("unavailable");
}

export async function verifyStudentOtp(input: {
  universityId: string;
  email: string;
  code: string;
}): Promise<{ account: StudentAccount; deviceToken: string }> {
  const env = getServerEnv();
  const idHash = hmacUniversityId(input.universityId, env.ID_HASH_SECRET);
  const supabase = createSupabaseAdmin();
  const { data: challenge, error } = await supabase.from("student_email_otps")
    .select("id,customer_name,otp_hash,attempts")
    .eq("university_id_hash", idHash)
    .eq("email", input.email)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError("unavailable");
  if (!challenge || challenge.attempts >= 5) throw new AppError("unauthorized");

  const submittedHash = otpHash(idHash, input.email, input.code);
  if (!safeEqualHex(submittedHash, challenge.otp_hash)) {
    const nextAttempts = challenge.attempts + 1;
    await supabase.from("student_email_otps").update({
      attempts: nextAttempts,
      ...(nextAttempts >= 5 ? { consumed_at: new Date().toISOString() } : {}),
    }).eq("id", challenge.id).lt("attempts", 5).is("consumed_at", null);
    throw new AppError("unauthorized");
  }

  const consumedAt = new Date().toISOString();
  const { data: consumed, error: consumeError } = await supabase.from("student_email_otps")
    .update({ consumed_at: consumedAt }).eq("id", challenge.id).is("consumed_at", null).select("id").maybeSingle();
  if (consumeError) throw new AppError("unavailable");
  if (!consumed) throw new AppError("unauthorized");

  const { data: existingById, error: existingError } = await supabase.from("student_accounts")
    .select("id,email,university_id_hash,customer_name").eq("university_id_hash", idHash).maybeSingle();
  if (existingError) throw new AppError("unavailable");
  if (existingById && existingById.email !== input.email) throw new AppError("unauthorized");

  const name = existingById?.customer_name ?? challenge.customer_name;
  const { data: account, error: accountError } = await supabase.from("student_accounts").upsert({
    university_id_hash: idHash,
    email: input.email,
    customer_name: name,
    email_verified_at: consumedAt,
    updated_at: consumedAt,
  }, { onConflict: "university_id_hash" }).select("id,email,university_id_hash,customer_name").single();
  if (accountError || !account) throw new AppError("unauthorized");

  const deviceToken = randomBytes(32).toString("base64url");
  const { error: deviceError } = await supabase.from("student_devices").insert({
    student_account_id: account.id,
    device_token_hash: sha256Hex(deviceToken),
    expires_at: new Date(Date.now() + DEVICE_DAYS * 24 * 60 * 60_000).toISOString(),
  });
  if (deviceError) throw new AppError("unavailable");
  return { account: account as StudentAccount, deviceToken };
}

export async function getStudentFromRequest(request: Request): Promise<StudentAccount | null> {
  const token = cookieValue(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("student_devices")
    .select("student_accounts(id,university_id_hash,email,customer_name)")
    .eq("device_token_hash", sha256Hex(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new AppError("unavailable");
  const account = data?.student_accounts;
  return (Array.isArray(account) ? account[0] : account) as StudentAccount | null;
}

export async function revokeStudentDevice(request: Request): Promise<void> {
  const token = cookieValue(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const { error } = await createSupabaseAdmin().from("student_devices")
    .delete().eq("device_token_hash", sha256Hex(token));
  if (error) throw new AppError("unavailable");
}

