import { createSupabaseAdmin } from "@/lib/db/client";
import { getOrderById } from "@/lib/db/orders";
import { requireOrderOwner } from "@/lib/order-access";
import { AppError, respond } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await context.params;
    const order = await requireOrderOwner(id, request);
    const now = new Date();
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.from("orders")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("id", order.id)
      .eq("status", "received")
      .select("id,token,status")
      .maybeSingle();
    if (error) throw new AppError("unavailable");
    if (!data) {
      // A second read distinguishes an illegal transition from a vanished row without exposing it.
      const current = await getOrderById(order.id);
      if (!current) throw new AppError("not_found");
      throw new AppError("invalid_transition");
    }
    return Response.json({ token: data.token, status: data.status, serverTime: now.toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return respond(error);
  }
}
