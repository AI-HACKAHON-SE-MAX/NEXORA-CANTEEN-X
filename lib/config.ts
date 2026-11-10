import "server-only";

export * from "./config-values";

export type ServerEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ID_HASH_SECRET: string;
  STAFF_PIN_SALT: string;
  STAFF_PIN_HASH: string;
  SESSION_SECRET: string;
  GEMINI_API_KEY?: string;
  RESEND_API_KEY?: string;
  STUDENT_OTP_FROM?: string;
};

const requiredEnvNames = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ID_HASH_SECRET",
  "STAFF_PIN_SALT",
  "STAFF_PIN_HASH",
  "SESSION_SECRET",
] as const;

/** Read secrets only when a server handler needs them; never expose their values. */
export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const missing = requiredEnvNames.filter((name) => !source[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable names: ${missing.join(", ")}`);
  }

  const invalid = [
    ...(source.ID_HASH_SECRET!.length < 32 ? ["ID_HASH_SECRET"] : []),
    ...(!/^[0-9a-f]{64}$/i.test(source.STAFF_PIN_HASH!) ? ["STAFF_PIN_HASH"] : []),
    ...(source.STAFF_PIN_SALT!.length < 16 ? ["STAFF_PIN_SALT"] : []),
    ...(source.SESSION_SECRET!.length < 32 ? ["SESSION_SECRET"] : []),
  ];
  if (invalid.length > 0) {
    throw new Error(`Invalid required environment variable names: ${invalid.join(", ")}`);
  }

  return {
    SUPABASE_URL: source.SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY!,
    ID_HASH_SECRET: source.ID_HASH_SECRET!,
    STAFF_PIN_SALT: source.STAFF_PIN_SALT!,
    STAFF_PIN_HASH: source.STAFF_PIN_HASH!,
    SESSION_SECRET: source.SESSION_SECRET!,
    GEMINI_API_KEY: source.GEMINI_API_KEY?.trim() || undefined,
    RESEND_API_KEY: source.RESEND_API_KEY?.trim() || undefined,
    STUDENT_OTP_FROM: source.STUDENT_OTP_FROM?.trim() || undefined,
  };
}
