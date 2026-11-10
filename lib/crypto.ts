import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export function randomOrderKey(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashOrderKey(orderKey: string): string {
  return sha256Hex(orderKey);
}

export function hmacUniversityId(universityId: string, secret: string): string {
  const canonicalId = universityId.trim().toUpperCase().replace(/^CIIT\//, "").replace(/\/ISB$/, "");
  return createHmac("sha256", secret).update(canonicalId, "utf8").digest("hex");
}

export function safeEqualHex(leftHex: string, rightHex: string): boolean {
  if (!/^(?:[0-9a-f]{2})+$/i.test(leftHex) || !/^(?:[0-9a-f]{2})+$/i.test(rightHex)) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function verifyStaffPin(pin: string, salt: string, expectedHashHex: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(expectedHashHex)) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(pin, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
  return safeEqualHex(derived.toString("hex"), expectedHashHex);
}
