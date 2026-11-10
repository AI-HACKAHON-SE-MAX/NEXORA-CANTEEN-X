import { KitchenDashboard } from "@/components/KitchenDashboard";
import { requireStaffPage } from "@/lib/page-auth";

export default async function KitchenPage() {
  await requireStaffPage();
  return <KitchenDashboard />;
}
