import { createSupabaseAdmin } from "@/lib/db/client";
import { publicOrderItems, sweepExpiredOrders } from "@/lib/db/orders";
import { AppError, respond } from "@/lib/errors";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireStaff(request);
    await sweepExpiredOrders();
    const supabase = createSupabaseAdmin();
    const [rowsResult, countResult] = await Promise.all([
      supabase.from("orders")
        .select("id,token,status,estimated_ready_at,created_at,order_items(item_name,quantity,unit_price,menu_items(id,name,prep_minutes))")
        .in("status", ["received", "preparing", "ready"])
        .order("created_at", { ascending: true })
        .limit(50),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .in("status", ["received", "preparing", "ready"]),
    ]);
    if (rowsResult.error || countResult.error) throw new AppError("unavailable");
    const orders = (rowsResult.data ?? []).map((order) => ({
      id: order.id,
      token: order.token,
      status: order.status,
      items: publicOrderItems(order),
      createdAt: order.created_at,
      estimatedReadyAt: order.estimated_ready_at,
    }));
    return Response.json({ orders, moreCount: Math.max(0, (countResult.count ?? 0) - orders.length) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return respond(error);
  }
}
