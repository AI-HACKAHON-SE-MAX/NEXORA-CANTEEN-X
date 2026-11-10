import { createSupabaseAdmin } from "@/lib/db/client";
import { AppError, respond } from "@/lib/errors";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireStaff(request);
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.from("menu_items")
      .select("id,name,description,price,prep_minutes,is_available")
      .order("name", { ascending: true });
    if (error) throw new AppError("unavailable");
    const items = (data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      prepMinutes: item.prep_minutes,
      isAvailable: item.is_available,
    }));
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error);
  }
}
