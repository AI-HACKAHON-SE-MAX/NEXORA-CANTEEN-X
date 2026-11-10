import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const ignored = new Set([".git", ".next", "node_modules", "coverage"]);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".json"]);
const publicPrefix = ["NEXT", "PUBLIC"].join("_") + "_";
const sensitiveSuffixes = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ID_HASH_SECRET", "STAFF_PIN_HASH", "SESSION_SECRET"];
const forbidden = sensitiveSuffixes.map((suffix) => `${publicPrefix}${suffix}`);
const hits = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(fullPath);
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (!sourceExtensions.has(extension)) continue;
    const content = await readFile(fullPath, "utf8");
    for (const marker of forbidden) {
      if (content.includes(marker)) hits.push(`${relative(root, fullPath)} contains a public server-secret variable`);
    }
  }
}

await scan(root);
if (hits.length) {
  for (const hit of hits) process.stderr.write(`${hit}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Security source scan passed.\n");
}
