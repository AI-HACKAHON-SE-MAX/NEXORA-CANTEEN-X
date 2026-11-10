import { AppError, respond } from "@/lib/errors";
import { originCheck } from "@/lib/session";
import { sendStudentOtp } from "@/lib/student-auth";
import { readJson } from "@/lib/request";
import { studentAuthStartSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    originCheck(request);
    const parsed = studentAuthStartSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation_error");
    await sendStudentOtp({ request, ...parsed.data });
    return Response.json({ ok: true, message: "If the details can be verified, a code was sent to that email." }, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return respond(error);
  }
}
