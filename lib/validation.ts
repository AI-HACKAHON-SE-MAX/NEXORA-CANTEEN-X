import { z } from "zod";
import {
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
  items: z.array(orderLineSchema).min(1).max(MAX_LINES),
  idempotencyKey: z.string().uuid(),
  demoMode: z.boolean().optional(),
}).strict();

const mergedOrderSchema = z.object({
  items: z.array(orderLineSchema).min(1).max(MAX_LINES),
  idempotencyKey: z.string().uuid(),
  demoMode: z.boolean(),
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
      items: Array.from(merged, ([menuItemId, quantity]) => ({ menuItemId, quantity })),
      idempotencyKey: order.idempotencyKey,
      demoMode: order.demoMode ?? false,
    };
  })
  .pipe(mergedOrderSchema);

export const orderIdSchema = z.string().uuid();
export const orderKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

// CUI registration examples include FA16-BBA-000 and CIIT/SP20-PMS-001/ISB.
export const universityIdSchema = z.string().trim().toUpperCase()
  .regex(/^(?:CIIT\/)?(?:FA|SP)\d{2}-[A-Z]{2,4}-\d{3,4}(?:\/ISB)?$/)
  .transform((id) => id.replace(/^CIIT\//, "").replace(/\/ISB$/, ""));
export const studentNameSchema = z.string().trim().min(NAME_LEN.min).max(NAME_LEN.max)
  .regex(/^\p{L}+(?:[ ]+\p{L}+)*$/u);
export const studentEmailSchema = z.string().trim().toLowerCase().email().max(254);
export const studentAuthStartSchema = z.object({
  universityId: universityIdSchema,
  customerName: studentNameSchema,
  email: studentEmailSchema,
}).strict();
export const studentAuthVerifySchema = z.object({
  universityId: universityIdSchema,
  email: studentEmailSchema,
  code: z.string().regex(/^\d{6}$/),
}).strict();

const statuses = ["received", "preparing", "ready", "picked_up", "cancelled", "expired"] as const;
export const statusChangeSchema = z.object({
  from: z.enum(statuses),
  to: z.enum(statuses),
}).strict();

export const loginSchema = z.object({
  pin: z.string().regex(/^\d{4,12}$/),
}).strict();
