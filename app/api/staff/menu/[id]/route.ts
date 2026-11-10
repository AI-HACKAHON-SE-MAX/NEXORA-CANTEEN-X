import { createSupabaseAdmin } from "@/lib/db/client";
import { AppError, respond } from "@/lib/errors";
import { originCheck, requireStaff } from "@/lib/session";
import { readJson } from "@/lib/request";
import { orderIdSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const availabilitySchema = z.object({ isAvailable: z.boolean() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireStaff(request);
    originCheck(request);
    const { id: rawId } = await context.params;
    const id = orderIdSchema.safeParse(rawId);
    const body = availabilitySchema.safeParse(await readJson(request));
    if (!id.success || !body.success) throw new AppError("validation_error");

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.from("menu_items")
      .update({ is_available: body.data.isAvailable })
      .eq("id", id.data)
      .select("id,is_available")
      .maybeSingle();
    if (error) throw new AppError("unavailable");
    if (!data) throw new AppError("not_found");
    return Response.json({ id: data.id, isAvailable: data.is_available }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return respond(error);
  }
}
