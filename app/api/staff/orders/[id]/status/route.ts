import { createSupabaseAdmin } from "@/lib/db/client";
import type { OrderStatus } from "@/lib/transitions";
import { canTransition } from "@/lib/transitions";
import { AppError, respond } from "@/lib/errors";
import { publicOrderItems } from "@/lib/db/orders";
import { originCheck, requireStaff } from "@/lib/session";
import { readJson } from "@/lib/request";
import { orderIdSchema, statusChangeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const statusChangedMessage = "This order changed on another device. Refresh and try again.";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireStaff(request);
    originCheck(request);
    const { id: rawId } = await context.params;
    const id = orderIdSchema.safeParse(rawId);
    const body = statusChangeSchema.safeParse(await readJson(request));
    if (!id.success || !body.success) throw new AppError("validation_error");
    const { from, to } = body.data;
    if (!canTransition(from as OrderStatus, to as OrderStatus, "staff")) {
      throw new AppError("invalid_transition");
    }

    const now = new Date().toISOString();
    const update: Record<string, string | boolean | null> = { status: to, updated_at: now };
    const steppedBack = (from === "preparing" && to === "received") || (from === "ready" && to === "preparing");
    if (steppedBack) update.was_stepped_back = true;
    if (from === "received" && to === "preparing") update.preparing_at = now;
    if (from === "preparing" && to === "ready") update.ready_at = now;
    if (from === "ready" && to === "picked_up") update.picked_up_at = now;
    if (from === "preparing" && to === "received") {
      update.preparing_at = null;
      update.ready_at = null;
    }
    if (from === "ready" && to === "preparing") {
      update.preparing_at = now;
      update.ready_at = null;
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.from("orders")
      .update(update)
      .eq("id", id.data)
      .eq("status", from)
      .select("id,token,status,estimated_minutes,estimated_ready_at,order_items(item_name,quantity,unit_price,menu_items(id,name,prep_minutes))")
      .maybeSingle();
    if (error) throw new AppError("unavailable");
    if (!data) {
      const { data: current, error: currentError } = await supabase.from("orders")
        .select("status").eq("id", id.data).maybeSingle();
      if (currentError) throw new AppError("unavailable");
      if (!current) throw new AppError("not_found");
      return Response.json({
        error: { code: "status_changed", message: statusChangedMessage },
        currentStatus: current.status,
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({
      id: data.id,
      token: data.token,
      status: data.status,
      items: publicOrderItems(data),
      estimatedMinutes: data.estimated_minutes,
      estimatedReadyAt: data.estimated_ready_at,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error);
  }
}
