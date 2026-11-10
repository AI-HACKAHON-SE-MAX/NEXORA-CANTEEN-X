import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { staffCookieName, verifySession } from "./session";

export async function requireStaffPage(): Promise<void> {
  const token = (await cookies()).get(staffCookieName)?.value;
  if (!token || !(await verifySession(token))) redirect("/staff-login");
}
