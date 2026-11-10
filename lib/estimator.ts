import {
  BATCH_FACTOR,
  CALIBRATION_SAMPLE,
  CALIBRATION_WINDOW_MINUTES,
  DEFAULT_PREP_MIN,
  DISPLAY_CAP_MINUTES,
  FACTOR_CLAMP,
  KITCHEN_STATIONS,
  MIN_CALIBRATION_SAMPLES,
  PREPARING_REMAINING_FACTOR,
  RATIO_CLAMP,
} from "./config-values";
import type { OrderStatus } from "./transitions";

export type EstimateItem = { prepMinutes: number | null | undefined; quantity: number };
export type EstimateQueueOrder = {
  createdAt: Date | string;
  status: Extract<OrderStatus, "received" | "preparing" | "ready">;
  items: EstimateItem[];
};
export type CalibrationSample = {
  estimatedMinutes: number;
  actualMinutes: number;
  createdAt: Date | string;
  wasSteppedBack: boolean;
};

export type EstimateInput = {
  items: EstimateItem[];
  queue?: EstimateQueueOrder[];
  createdAt?: Date | string;
  status?: Extract<OrderStatus, "received" | "preparing" | "ready">;
  stations?: number;
  factor?: number;
  estimatedReadyAt?: Date | string;
  now: Date;
};

export type EstimateResult = {
  minutes: number;
  capped: boolean;
  state: "estimate" | "ready_now" | "any_moment_now";
};

function validDateMs(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

function linePrep(item: EstimateItem): number {
  const prep = item.prepMinutes;
  const base = typeof prep === "number" && Number.isFinite(prep) && prep > 0 ? prep : DEFAULT_PREP_MIN;
  const rawQuantity = Number.isFinite(item.quantity) ? Math.floor(item.quantity) : 1;
  const quantity = Math.min(10, Math.max(1, rawQuantity));
  return base + (quantity - 1) * base * BATCH_FACTOR;
}

export function ownPrepMinutes(items: EstimateItem[]): number {
  return items.reduce((total, item) => total + linePrep(item), 0);
}

function activeWork(order: EstimateQueueOrder): number {
  const prep = ownPrepMinutes(order.items);
  if (order.status === "received") return prep;
  if (order.status === "preparing") return prep * PREPARING_REMAINING_FACTOR;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calibrationFactor(samples: CalibrationSample[], now: Date): number {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return 1;
  const valid = samples.filter((sample) => {
    const createdAt = validDateMs(sample.createdAt);
    return !sample.wasSteppedBack &&
      Number.isFinite(createdAt) && createdAt <= nowMs &&
      nowMs - createdAt <= CALIBRATION_WINDOW_MINUTES * 60_000 &&
      Number.isFinite(sample.estimatedMinutes) && sample.estimatedMinutes > 0 &&
      Number.isFinite(sample.actualMinutes) && sample.actualMinutes > 0;
  }).sort((a, b) => validDateMs(b.createdAt) - validDateMs(a.createdAt))
    .slice(0, CALIBRATION_SAMPLE);

  if (valid.length < MIN_CALIBRATION_SAMPLES) return 1;
  const ratios = valid.map((sample) => clamp(sample.actualMinutes / sample.estimatedMinutes, RATIO_CLAMP.min, RATIO_CLAMP.max))
    .sort((a, b) => a - b);
  const middle = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 === 0
    ? (ratios[middle - 1] + ratios[middle]) / 2
    : ratios[middle];
  return Number.isFinite(median) ? clamp(median, FACTOR_CLAMP.min, FACTOR_CLAMP.max) : 1;
}

export function estimateReadyTime(input: EstimateInput): EstimateResult {
  const nowMs = input.now.getTime();
  const status = input.status ?? "received";
  const queue = input.queue ?? [];
  const orderCreatedAt = input.createdAt === undefined ? Number.POSITIVE_INFINITY : validDateMs(input.createdAt);
  const queueWork = queue.reduce((total, order) => {
    const createdAt = validDateMs(order.createdAt);
    const isAhead = input.createdAt === undefined || (Number.isFinite(createdAt) && createdAt < orderCreatedAt);
    return isAhead ? total + activeWork(order) : total;
  }, 0);
  const configuredStations = input.stations ?? KITCHEN_STATIONS;
  const stations = Number.isFinite(configuredStations) && configuredStations > 0
    ? Math.max(1, Math.floor(configuredStations))
    : 1;
  const own = ownPrepMinutes(input.items);
  const remaining = status === "received"
    ? own
    : status === "preparing"
      ? own * PREPARING_REMAINING_FACTOR
      : 0;
  const factor = typeof input.factor === "number" && Number.isFinite(input.factor)
    ? clamp(input.factor, FACTOR_CLAMP.min, FACTOR_CLAMP.max)
    : 1;
  const rawMinutes = (queueWork / stations + remaining) * factor;
  const uncappedMinutes = Math.max(1, Math.ceil(Number.isFinite(rawMinutes) ? rawMinutes : 1));
  const capped = uncappedMinutes > DISPLAY_CAP_MINUTES;
  const minutes = Math.min(DISPLAY_CAP_MINUTES, uncappedMinutes);

  let state: EstimateResult["state"] = "estimate";
  if (status === "ready") {
    state = "ready_now";
  } else if (input.estimatedReadyAt !== undefined && Number.isFinite(nowMs)) {
    const readyAtMs = validDateMs(input.estimatedReadyAt);
    if (Number.isFinite(readyAtMs) && readyAtMs <= nowMs) state = "any_moment_now";
  }
  return { minutes, capped, state };
}
