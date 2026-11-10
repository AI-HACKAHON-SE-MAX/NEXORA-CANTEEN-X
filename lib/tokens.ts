import { AppError } from "./errors";

export function tokenFromCounter(counter: number): string {
  if (!Number.isInteger(counter) || counter < 1) throw new AppError("validation_error");
  if (counter > 26 * 99) throw new AppError("daily_limit");
  const letter = String.fromCharCode("A".charCodeAt(0) + Math.floor((counter - 1) / 99));
  const number = ((counter - 1) % 99) + 1;
  return `${letter}${String(number).padStart(2, "0")}`;
}
