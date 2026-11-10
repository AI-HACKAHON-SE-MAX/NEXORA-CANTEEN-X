import { AdminDashboard } from "@/components/AdminDashboard";
import { requireStaffPage } from "@/lib/page-auth";

export default async function AdminPage() {
  await requireStaffPage();
  return <AdminDashboard />;
}
