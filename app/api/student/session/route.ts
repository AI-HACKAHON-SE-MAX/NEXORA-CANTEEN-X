import { getStudentFromRequest } from "@/lib/student-auth";
import { getDemoStudentFromRequest } from "@/lib/demo-student";
import { AppError, respond } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const demoMode = new URL(request.url).searchParams.get("mode") === "demo";
    const account = demoMode ? await getDemoStudentFromRequest(request) : await getStudentFromRequest(request);
    return Response.json(account
      ? { authenticated: true, demo: demoMode, student: { name: account.customer_name, isDemo: demoMode } }
      : { authenticated: false, demo: demoMode },
    { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respond(error instanceof AppError ? error : new AppError("unavailable"));
  }
}
