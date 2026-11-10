import { createSupabaseAdmin } from "@/lib/db/client";
import { AppError, respond } from "@/lib/errors";
import { karachiDay, karachiHour } from "@/lib/time";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

type AnalyticsOrder = {
  status: string;
  total_price: number;
  estimated_minutes: number;
  created_at: string;
  ready_at: string | null;
  was_stepped_back: boolean;
  is_demo: boolean;
  order_items: Array<{ item_name: string; quantity: number }>;
};

export async function GET(request: Request): Promise<Response> {
  try {
    await requireStaff(request);
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.from("orders")
      .select("status,is_demo,total_price,estimated_minutes,created_at,ready_at,was_stepped_back,order_items(item_name,quantity)")
      .eq("order_day", karachiDay());
    if (error) throw new AppError("unavailable");
    const orders = (data ?? []) as unknown as AnalyticsOrder[];
    const ordersPerHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const itemCounts = new Map<string, number>();
    let completedCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let demoOrders = 0;
    let revenue = 0;
    const prepTimes: number[] = [];
    const estimateErrors: number[] = [];

    for (const order of orders) {
      if (order.is_demo) { demoOrders += 1; continue; }
      ordersPerHour[karachiHour(new Date(order.created_at))].count += 1;
      if (order.status === "picked_up") {
        completedCount += 1;
        revenue += order.total_price;
      }
      if (order.status === "cancelled") cancelledCount += 1;
      if (order.status === "expired") expiredCount += 1;
      if (order.status !== "cancelled" && order.status !== "expired") {
        for (const item of order.order_items ?? []) {
          itemCounts.set(item.item_name, (itemCounts.get(item.item_name) ?? 0) + item.quantity);
        }
      }
      if (order.ready_at) {
        const actualMinutes = (new Date(order.ready_at).getTime() - new Date(order.created_at).getTime()) / 60_000;
        if (Number.isFinite(actualMinutes) && actualMinutes >= 0) {
          if (!order.was_stepped_back) prepTimes.push(actualMinutes);
          estimateErrors.push(Math.abs(actualMinutes - order.estimated_minutes));
        }
      }
    }

    const topItem = [...itemCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const average = (values: number[]) => values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null;
    return Response.json({
      day: karachiDay(),
      ordersTotal: orders.length - demoOrders,
      demoOrders,
      completedCount,
      cancelledCount,
      expiredCount,
      revenue,
      topItem: topItem ? { name: topItem[0], quantity: topItem[1] } : null,
      ordersPerHour,
      avgActualPrepMinutes: average(prepTimes),
      estimateAccuracy: average(estimateErrors),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error);
  }
}
