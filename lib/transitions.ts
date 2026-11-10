export const ORDER_STATUSES = [
  "received",
  "preparing",
  "ready",
  "picked_up",
  "cancelled",
  "expired",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type TransitionActor = "staff" | "student" | "system";

const terminalStatuses = new Set<OrderStatus>(["picked_up", "cancelled", "expired"]);
const activeStatuses = new Set<OrderStatus>(["received", "preparing", "ready"]);

export function isTerminal(status: OrderStatus): boolean {
  return terminalStatuses.has(status);
}

export function isActive(status: OrderStatus): boolean {
  return activeStatuses.has(status);
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: TransitionActor): boolean {
  if (isTerminal(from)) return false;
  if (actor === "student") return from === "received" && to === "cancelled";
  if (actor === "system") return isActive(from) && to === "expired";
  return (
    (from === "received" && to === "preparing") ||
    (from === "preparing" && (to === "ready" || to === "received")) ||
    (from === "ready" && (to === "picked_up" || to === "preparing"))
  );
}

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case "received": return ["preparing"];
    case "preparing": return ["ready", "received"];
    case "ready": return ["picked_up", "preparing"];
    default: return [];
  }
}
