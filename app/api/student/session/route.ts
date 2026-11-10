import { getStudentFromRequest } from "@/lib/student-auth";
import { AppError, respond } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const account = await getStudentFromRequest(request);
    return Response.json(account
      ? { authenticated: true, student: { name: account.customer_name } }
      : { authenticated: false },
    { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error instanceof AppError ? error : new AppError("unavailable"));
  }
}
