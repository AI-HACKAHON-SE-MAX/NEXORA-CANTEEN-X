import { createClient } from "@supabase/supabase-js";
import process from "node:process";

const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((name) => !process.env[name]?.trim());
if (missing.length) {
  process.stderr.write(`Missing required environment variable names: ${missing.join(", ")}\n`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error } = await supabase.from("rate_limits").delete().like("key", "pin-%:%");
if (error) {
  process.stderr.write("Could not reset the staff PIN lockout.\n");
  process.exit(1);
}
process.stdout.write("Staff PIN rate-limit counters cleared.\n");
