import { createClient } from "@supabase/supabase-js";
import process from "node:process";

const force = process.argv.includes("--force");
if (process.env.NODE_ENV === "production" && !force) {
  process.stderr.write("Refusing to reset demo data in production without --force.\n");
  process.exit(1);
}

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  process.stderr.write(`Missing required environment variable names: ${missing.join(", ")}\n`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const menu = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Aloo Samosa", description: "Crisp potato pastry with mint chutney.", price: 50, prep_minutes: 2, is_available: true },
  { id: "10000000-0000-4000-8000-000000000002", name: "Chicken Roll", description: "Spiced chicken wrapped in a warm paratha.", price: 190, prep_minutes: 5, is_available: true },
  { id: "10000000-0000-4000-8000-000000000003", name: "Masala Fries", description: "Golden fries tossed with house masala.", price: 160, prep_minutes: 5, is_available: true },
  { id: "10000000-0000-4000-8000-000000000004", name: "Chicken Biryani", description: "Aromatic rice with chicken and raita.", price: 280, prep_minutes: 8, is_available: true },
  { id: "10000000-0000-4000-8000-000000000005", name: "Doodh Patti Chai", description: "Strong milk tea brewed to order.", price: 70, prep_minutes: 3, is_available: true },
  { id: "10000000-0000-4000-8000-000000000006", name: "Mint Lemonade", description: "Fresh lemon, mint, and chilled water.", price: 110, prep_minutes: 2, is_available: true },
  { id: "10000000-0000-4000-8000-000000000007", name: "Veggie Sandwich", description: "Toasted bread with crisp vegetables.", price: 150, prep_minutes: 4, is_available: true },
  { id: "10000000-0000-4000-8000-000000000008", name: "Chocolate Brownie", description: "Soft cocoa brownie baked in small batches.", price: 130, prep_minutes: 3, is_available: true },
  { id: "10000000-0000-4000-8000-000000000009", name: "Chicken Cheese Paratha", description: "Flaky paratha with chicken and melted cheese.", price: 240, prep_minutes: 7, is_available: true },
];

async function resetTable(table, column) {
  const { error } = await supabase.from(table).delete().not(column, "is", null);
  if (error) throw new Error("A database operation failed during demo reset.");
}

try {
  await resetTable("orders", "id"); // order_items are removed by the foreign-key cascade.
  await resetTable("rate_limits", "key");
  await resetTable("token_counters", "day");
  const { error } = await supabase.from("menu_items").upsert(menu, { onConflict: "id" });
  if (error) throw new Error("A database operation failed during demo reset.");
  process.stdout.write("Demo data reset completed.\n");
} catch {
  process.stderr.write("Demo reset failed. Confirm the schema is applied and the server environment is set.\n");
  process.exitCode = 1;
}
