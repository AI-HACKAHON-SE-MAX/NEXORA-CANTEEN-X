import "server-only";
import { createSupabaseAdmin } from "./client";
import { AppError } from "../errors";
import { ACTIVE_MAX_MINUTES, READY_UNCOLLECTED_MINUTES } from "../config-values";
import { checkRateLimit } from "../ratelimit";

export type DbMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  prep_minutes: number;
  image_url: string | null;
  is_available: boolean;
};

export type DbOrderItem = {
  item_name: string;
  quantity: number;
  unit_price: number;
  menu_items: Pick<DbMenuItem, "id" | "name" | "prep_minutes"> | null;
};

export type DbOrder = {
  id: string;
  token: string;
  order_day: string;
  order_key_hash: string;
  university_id_hash: string;
  customer_name: string;
  status: "received" | "preparing" | "ready" | "picked_up" | "cancelled" | "expired";
  total_price: number;
  estimated_minutes: number;
  estimated_ready_at: string;
  idempotency_key: string;
  was_stepped_back: boolean;
  created_at: string;
  updated_at: string;
  preparing_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  order_items: DbOrderItem[];
};

export type QueueDbOrder = {
  status: Extract<DbOrder["status"], "received" | "preparing" | "ready">;
  created_at: string;
  order_items: Array<Pick<DbOrderItem, "quantity" | "menu_items">>;
};

export type CalibrationDbOrder = Pick<DbOrder,
  "estimated_minutes" | "was_stepped_back" | "preparing_at" | "ready_at" | "picked_up_at"
>;

export async function listMenu(): Promise<DbMenuItem[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("menu_items")
    .select("id,name,description,price,prep_minutes,image_url,is_available")
    .order("name", { ascending: true });
  if (error) throw new AppError("unavailable");
  return (data ?? []) as DbMenuItem[];
}

export async function getMenuItemsByIds(ids: string[]): Promise<DbMenuItem[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("menu_items")
    .select("id,name,description,price,prep_minutes,image_url,is_available")
    .in("id", ids);
  if (error) throw new AppError("unavailable");
  return (data ?? []) as DbMenuItem[];
}

export async function loadActiveOrders(): Promise<QueueDbOrder[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("orders")
    .select("status,created_at,order_items(quantity,menu_items(prep_minutes))")
    .in("status", ["received", "preparing", "ready"])
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new AppError("unavailable");
  return (data ?? []) as unknown as QueueDbOrder[];
}

export async function getOrderById(id: string): Promise<DbOrder | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("orders")
    .select("id,token,order_day,order_key_hash,university_id_hash,customer_name,status,total_price,estimated_minutes,estimated_ready_at,idempotency_key,was_stepped_back,created_at,updated_at,preparing_at,ready_at,picked_up_at,order_items(item_name,quantity,unit_price,menu_items(id,name,prep_minutes))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("unavailable");
  return data as unknown as DbOrder | null;
}

export async function loadCalibrationOrders(since: string): Promise<CalibrationDbOrder[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("orders")
    .select("estimated_minutes,was_stepped_back,preparing_at,ready_at,picked_up_at")
    .eq("status", "picked_up")
    .eq("was_stepped_back", false)
    .gte("picked_up_at", since)
    .order("picked_up_at", { ascending: false })
    .limit(10);
  if (error) throw new AppError("unavailable");
  return (data ?? []) as unknown as CalibrationDbOrder[];
}

export async function sweepExpiredOrders(): Promise<void> {
  const limit = await checkRateLimit("expiry-sweep", "all", 30, 1);
  if (!limit.allowed) return;
  const now = new Date();
  const activeCutoff = new Date(now.getTime() - ACTIVE_MAX_MINUTES * 60_000).toISOString();
  const readyCutoff = new Date(now.getTime() - READY_UNCOLLECTED_MINUTES * 60_000).toISOString();
  const supabase = createSupabaseAdmin();
  const [activeResult, readyResult] = await Promise.all([
    supabase.from("orders").update({ status: "expired", updated_at: now.toISOString() })
      .in("status", ["received", "preparing"]).lt("created_at", activeCutoff),
    supabase.from("orders").update({ status: "expired", updated_at: now.toISOString() })
      .eq("status", "ready").lt("ready_at", readyCutoff),
  ]);
  if (activeResult.error || readyResult.error) throw new AppError("unavailable");
}

export async function createOrderTransaction(input: {
  orderDay: string;
  orderKeyHash: string;
  universityIdHash: string;
  customerName: string;
  idempotencyKey: string;
  estimatedMinutes: number;
  estimatedReadyAt: string;
  items: Array<{ menuItemId: string; quantity: number }>;
}): Promise<Pick<DbOrder, "id" | "token" | "status" | "total_price" | "estimated_minutes" | "estimated_ready_at" | "created_at"> & {
  items: Array<{ name: string; quantity: number }>;
}> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("create_order_tx", {
    p_order_day: input.orderDay,
    p_order_key_hash: input.orderKeyHash,
    p_university_id_hash: input.universityIdHash,
    p_customer_name: input.customerName,
    p_idempotency_key: input.idempotencyKey,
    p_estimated_minutes: input.estimatedMinutes,
    p_estimated_ready_at: input.estimatedReadyAt,
    p_items: input.items,
  });
  if (error) {
    const message = error.message;
    if (message === "active_order_limit") throw new AppError("active_order_limit");
    if (message === "duplicate_submit") throw new AppError("duplicate_submit");
    if (message === "item_unavailable") throw new AppError("item_unavailable");
    if (message === "daily_limit") throw new AppError("daily_limit");
    if (message === "validation_error") throw new AppError("validation_error");
    throw new AppError("unavailable");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !Array.isArray(row.items)) throw new AppError("unavailable");
  return row as Pick<DbOrder, "id" | "token" | "status" | "total_price" | "estimated_minutes" | "estimated_ready_at" | "created_at"> & {
    items: Array<{ name: string; quantity: number }>;
  };
}

export function publicOrderItems(order: { order_items?: Array<Pick<DbOrderItem, "item_name" | "quantity">> | null }): Array<{ name: string; quantity: number }> {
  const items = order.order_items ?? [];
  if (items.some((item) => !item.item_name)) throw new AppError("unavailable");
  return items.map((item) => ({ name: item.item_name, quantity: item.quantity }));
}
