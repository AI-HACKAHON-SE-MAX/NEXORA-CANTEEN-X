import { TIMEZONE } from "./config-values";

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

function dateParts(date: Date): Record<string, string> {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map(({ type, value }) => [type, value]),
  );
}

export function karachiDay(date: Date = systemClock()): string {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function karachiHour(date: Date = systemClock()): number {
  return Number(dateParts(date).hour);
}
