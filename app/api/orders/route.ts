import { calibrationFactor, estimateReadyTime, type EstimateQueueOrder } from "@/lib/estimator";
import { ORDER_RATE, CALIBRATION_WINDOW_MINUTES } from "@/lib/config-values";
import { getServerEnv } from "@/lib/config";
import { AppError, respond } from "@/lib/errors";
import { createOrderTransaction, getMenuItemsByIds, loadActiveOrders, loadCalibrationOrders, sweepExpiredOrders } from "@/lib/db/orders";
import { randomOrderKey, hashOrderKey, hmacUniversityId } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { readJson } from "@/lib/request";
import { karachiDay } from "@/lib/time";
import { createOrderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = createOrderSchema.safeParse(await readJson(request));
    if (!body.success) throw new AppError("validation_error");

    const { ID_HASH_SECRET } = getServerEnv();
    const universityIdHash = hmacUniversityId(body.data.universityId, ID_HASH_SECRET);
    const ipLimit = await checkRateLimit("order-ip", getClientIp(request), ORDER_RATE.windowSeconds, ORDER_RATE.requests);
    if (!ipLimit.allowed) throw new AppError("rate_limited", { retryAfterSeconds: ipLimit.retryAfter });
    const idLimit = await checkRateLimit("order-id", universityIdHash, ORDER_RATE.windowSeconds, ORDER_RATE.perId);
    if (!idLimit.allowed) throw new AppError("rate_limited", { retryAfterSeconds: idLimit.retryAfter });
    await sweepExpiredOrders();

    const menuItems = await getMenuItemsByIds(body.data.items.map((item) => item.menuItemId));
    const menuById = new Map(menuItems.map((item) => [item.id, item]));
    const unavailableNames = body.data.items.flatMap((item) => {
      const menuItem = menuById.get(item.menuItemId);
      return !menuItem || !menuItem.is_available ? [menuItem?.name ?? "an item"] : [];
    });
    if (unavailableNames.length > 0) {
      throw new AppError("item_unavailable", {
        safeMessage: `Unavailable: ${unavailableNames.join(", ")}. Please update your cart.`,
      });
    }

    const now = new Date();
    const [queueRows, sampleRows] = await Promise.all([
      loadActiveOrders(),
      loadCalibrationOrders(new Date(now.getTime() - CALIBRATION_WINDOW_MINUTES * 60_000).toISOString()),
    ]);
    const queue: EstimateQueueOrder[] = queueRows.map((order) => ({
      createdAt: order.created_at,
      status: order.status as EstimateQueueOrder["status"],
      items: order.order_items.map((item) => ({ prepMinutes: item.menu_items?.prep_minutes, quantity: item.quantity })),
    }));
    const samples = sampleRows.flatMap((order) => {
      if (!order.preparing_at || !order.ready_at) return [];
      const actualMinutes = (new Date(order.ready_at).getTime() - new Date(order.preparing_at).getTime()) / 60_000;
      return [{
        estimatedMinutes: order.estimated_minutes,
        actualMinutes,
        createdAt: order.picked_up_at ?? order.ready_at,
        wasSteppedBack: order.was_stepped_back,
      }];
    });
    const factor = calibrationFactor(samples, now);
    const estimatorItems = body.data.items.map((item) => ({
      prepMinutes: menuById.get(item.menuItemId)!.prep_minutes,
      quantity: item.quantity,
    }));
    const estimate = estimateReadyTime({ items: estimatorItems, queue, factor, now });
    const orderKey = randomOrderKey();
    const estimatedReadyAt = new Date(now.getTime() + estimate.minutes * 60_000).toISOString();
    const created = await createOrderTransaction({
      orderDay: karachiDay(now),
      orderKeyHash: hashOrderKey(orderKey),
      universityIdHash,
      customerName: body.data.customerName,
      idempotencyKey: body.data.idempotencyKey,
      estimatedMinutes: estimate.minutes,
      estimatedReadyAt,
      items: body.data.items,
    });
    return Response.json({
      orderId: created.id,
      orderKey,
      token: created.token,
      status: created.status,
      items: created.items,
      total: created.total_price,
      estimatedMinutes: created.estimated_minutes,
      estimatedReadyAt: created.estimated_ready_at,
      serverTime: now.toISOString(),
      createdAt: created.created_at,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error);
  }
}
