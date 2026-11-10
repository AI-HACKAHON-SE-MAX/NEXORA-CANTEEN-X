import { z } from "zod";
import {
  ID_CHARSET,
  ID_LEN,
  MAX_LINES,
  MAX_QTY_PER_LINE,
  MAX_TOTAL_QTY,
  NAME_LEN,
} from "./config-values";

const orderLineSchema = z.object({
  menuItemId: z.string().uuid().transform((id) => id.toLowerCase()),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
}).strict();

const normalizedOrderSchema = z.object({
  universityId: z.string().trim().toUpperCase().min(ID_LEN.min).max(ID_LEN.max).regex(ID_CHARSET),
  customerName: z.string()
    .transform((value) => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim())
    .pipe(z.string().min(NAME_LEN.min).max(NAME_LEN.max)),
  items: z.array(orderLineSchema).min(1).max(MAX_LINES),
  idempotencyKey: z.string().uuid(),
}).strict();

const mergedOrderSchema = z.object({
  universityId: z.string().min(ID_LEN.min).max(ID_LEN.max).regex(ID_CHARSET),
  customerName: z.string().min(NAME_LEN.min).max(NAME_LEN.max),
  items: z.array(orderLineSchema).min(1).max(MAX_LINES),
  idempotencyKey: z.string().uuid(),
}).strict().refine(
  (order) => order.items.reduce((total, item) => total + item.quantity, 0) <= MAX_TOTAL_QTY,
  { message: "The total quantity is too high.", path: ["items"] },
);

export const createOrderSchema = normalizedOrderSchema
  .transform((order) => {
    const merged = new Map<string, number>();
    for (const item of order.items) {
      merged.set(item.menuItemId, (merged.get(item.menuItemId) ?? 0) + item.quantity);
    }
    return {
      ...order,
      items: Array.from(merged, ([menuItemId, quantity]) => ({ menuItemId, quantity })),
    };
  })
  .pipe(mergedOrderSchema);

export const orderIdSchema = z.string().uuid();
export const orderKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const statuses = ["received", "preparing", "ready", "picked_up", "cancelled", "expired"] as const;
export const statusChangeSchema = z.object({
  from: z.enum(statuses),
  to: z.enum(statuses),
}).strict();

export const loginSchema = z.object({
  pin: z.string().regex(/^\d{4,12}$/),
}).strict();
