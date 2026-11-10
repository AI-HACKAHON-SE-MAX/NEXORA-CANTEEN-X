import { randomBytes, scrypt } from "node:crypto";
import process from "node:process";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  process.stderr.write("Run this script in an interactive terminal so the PIN is not echoed.\n");
  process.exit(1);
}

process.stdout.write("Enter staff PIN (4-12 digits, hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let pin = "";

function finish() {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write("\n");
  if (!/^\d{4,12}$/.test(pin)) {
    process.stderr.write("PIN must contain 4 to 12 digits.\n");
    process.exit(1);
  }
  const salt = randomBytes(32).toString("hex");
  scrypt(pin, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, derived) => {
    pin = "";
    if (error) {
      process.stderr.write("Could not derive the PIN hash.\n");
      process.exit(1);
    }
    process.stdout.write(`STAFF_PIN_SALT=${salt}\nSTAFF_PIN_HASH=${derived.toString("hex")}\n`);
  });
}

process.stdin.on("data", (chunk) => {
  const input = chunk.toString("utf8");
  if (input === "\u0003") {
    pin = "";
    process.stdin.setRawMode(false);
    process.exit(130);
  }
  if (input === "\r" || input === "\n") return finish();
  if (input === "\u007f" || input === "\b") {
    pin = pin.slice(0, -1);
    return;
  }
  if (/^\d$/.test(input) && pin.length < 12) pin += input;
});
