import { CALIBRATION_WINDOW_MINUTES, POLL_RATE } from "@/lib/config-values";
import { AppError, respond } from "@/lib/errors";
import { getOrderById, loadActiveOrders, loadCalibrationOrders, publicOrderItems, sweepExpiredOrders } from "@/lib/db/orders";
import { requireOrderOwner } from "@/lib/order-access";
import { checkRateLimit } from "@/lib/ratelimit";
import { estimateReadyTime, calibrationFactor, type EstimateQueueOrder } from "@/lib/estimator";
import { isActive } from "@/lib/transitions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const authorizedOrder = await requireOrderOwner(id, request);
    const limit = await checkRateLimit("poll-order", authorizedOrder.id, POLL_RATE.windowSeconds, POLL_RATE.requests);
    if (!limit.allowed) throw new AppError("rate_limited", { retryAfterSeconds: limit.retryAfter });
    await sweepExpiredOrders();
    const order = await getOrderById(authorizedOrder.id);
    if (!order) throw new AppError("not_found");

    const serverTime = new Date();
    let estimatedMinutes: number | null = null;
    let estimatedReadyAt: string | null = null;
    if (isActive(order.status)) {
      const [queueRows, sampleRows] = await Promise.all([
        loadActiveOrders(),
        loadCalibrationOrders(new Date(serverTime.getTime() - CALIBRATION_WINDOW_MINUTES * 60_000).toISOString()),
      ]);
      const queue: EstimateQueueOrder[] = queueRows.map((row) => ({
        createdAt: row.created_at,
        status: row.status as EstimateQueueOrder["status"],
        items: row.order_items.map((item) => ({ prepMinutes: item.menu_items?.prep_minutes, quantity: item.quantity })),
      }));
      const samples = sampleRows.flatMap((row) => {
        if (!row.preparing_at || !row.ready_at) return [];
        return [{
          estimatedMinutes: row.estimated_minutes,
          actualMinutes: (new Date(row.ready_at).getTime() - new Date(row.preparing_at).getTime()) / 60_000,
          createdAt: row.picked_up_at ?? row.ready_at,
          wasSteppedBack: row.was_stepped_back,
        }];
      });
      const estimate = estimateReadyTime({
        items: order.order_items.map((item) => ({ prepMinutes: item.menu_items?.prep_minutes, quantity: item.quantity })),
        queue,
        createdAt: order.created_at,
        status: order.status as EstimateQueueOrder["status"],
        factor: calibrationFactor(samples, serverTime),
        estimatedReadyAt: order.estimated_ready_at,
        now: serverTime,
      });
      estimatedMinutes = estimate.minutes;
      estimatedReadyAt = estimate.state === "any_moment_now"
        ? order.estimated_ready_at
        : new Date(serverTime.getTime() + estimate.minutes * 60_000).toISOString();
    }

    return Response.json({
      token: order.token,
      status: order.status,
      isDemo: order.is_demo,
      items: publicOrderItems(order),
      total: order.total_price,
      estimatedMinutes,
      estimatedReadyAt,
      serverTime: serverTime.toISOString(),
      createdAt: order.created_at,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error);
  }
}
