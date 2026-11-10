import "server-only";
import { getOrderById, type DbOrder } from "./db/orders";
import { hashOrderKey, safeEqualHex } from "./crypto";
import { AppError } from "./errors";
import { orderIdSchema, orderKeySchema } from "./validation";

const dummyHash = "0".repeat(64);

export async function requireOrderOwner(idValue: string, request: Request): Promise<DbOrder> {
  const id = orderIdSchema.safeParse(idValue);
  const keyValue = request.headers.get("x-order-key") ?? "";
  const keyValid = orderKeySchema.safeParse(keyValue).success;
  const lookupId = id.success ? id.data : "00000000-0000-0000-0000-000000000000";
  const order = await getOrderById(lookupId);

  // Hash and timing-safe compare on every path so key failures share one response shape.
  const candidateHash = hashOrderKey(keyValue);
  const storedHash = order?.order_key_hash ?? dummyHash;
  const matches = safeEqualHex(candidateHash, storedHash);
  if (!id.success || !keyValid || !order || !matches) throw new AppError("not_found");
  return order;
}
