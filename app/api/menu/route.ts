import { listMenu } from "@/lib/db/orders";
import { respond } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const menu = await listMenu();
    return Response.json(
      { items: menu.map(({ id, name, description, price, prep_minutes, image_url, is_available }) => ({
        id, name, description, price, prepMinutes: prep_minutes, imageUrl: image_url, isAvailable: is_available,
      })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return respond(error);
  }
}
