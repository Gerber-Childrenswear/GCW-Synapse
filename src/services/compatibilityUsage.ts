import { getGtmCompatibilityMatrix } from "./gtmCompatibilityMatrix";

export type CompatibilityUsageStatus = "ok" | "error";

export type CompatibilityUsageEntry = {
  endpointPath: string;
  legacyVariable: string;
  status: CompatibilityUsageStatus;
  hits: number;
  lastHitAt?: string;
  eventFamilies: string[];
};

export type CompatibilityUsageByEndpoint = {
  endpointPath: string;
  legacyVariable: string;
  eventFamilies: string[];
  okHits: number;
  errorHits: number;
  totalHits: number;
  lastHitAt?: string;
  failureRatePct: number;
};

export type CompatibilityUsageTrendPoint = {
  endpointPath: string;
  bucketStart: string;
  okHits: number;
  errorHits: number;
  totalHits: number;
  failureRatePct: number;
};

type UsageAccumulator = CompatibilityUsageEntry;
type TrendAccumulator = {
  endpointPath: string;
  status: CompatibilityUsageStatus;
  bucketStart: string;
  hits: number;
};

const usageState = new Map<string, UsageAccumulator>();
const usageTrendState = new Map<string, TrendAccumulator>();

function makeKey(endpointPath: string, status: CompatibilityUsageStatus): string {
  return `${endpointPath}|${status}`;
}

function makeTrendKey(endpointPath: string, status: CompatibilityUsageStatus, bucketStart: string): string {
  return `${endpointPath}|${status}|${bucketStart}`;
}

function toHourBucket(iso: string): string {
  const date = new Date(iso);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function recordCompatibilityUsage(endpointPath: string, status: CompatibilityUsageStatus): void {
  const matrixEntry = getGtmCompatibilityMatrix().find((entry) => entry.endpointPath === endpointPath);
  if (!matrixEntry) {
    return;
  }

  const key = makeKey(endpointPath, status);
  const existing = usageState.get(key);
  const now = new Date().toISOString();

  usageState.set(key, {
    endpointPath,
    legacyVariable: matrixEntry.legacyVariable,
    status,
    hits: (existing?.hits ?? 0) + 1,
    lastHitAt: now,
    eventFamilies: matrixEntry.eventFamilies
  });

  const bucketStart = toHourBucket(now);
  const trendKey = makeTrendKey(endpointPath, status, bucketStart);
  const existingTrend = usageTrendState.get(trendKey);

  usageTrendState.set(trendKey, {
    endpointPath,
    status,
    bucketStart,
    hits: (existingTrend?.hits ?? 0) + 1
  });
}

export function getCompatibilityUsageSummary(): CompatibilityUsageEntry[] {
  return [...usageState.values()].sort((left, right) => {
    if (right.hits !== left.hits) {
      return right.hits - left.hits;
    }

    return left.legacyVariable.localeCompare(right.legacyVariable);
  });
}

export function getCompatibilityUsageByEndpoint(): CompatibilityUsageByEndpoint[] {
  const grouped = new Map<string, CompatibilityUsageByEndpoint>();

  for (const row of usageState.values()) {
    const existing = grouped.get(row.endpointPath);
    if (!existing) {
      const initial: CompatibilityUsageByEndpoint = {
        endpointPath: row.endpointPath,
        legacyVariable: row.legacyVariable,
        eventFamilies: row.eventFamilies,
        okHits: row.status === "ok" ? row.hits : 0,
        errorHits: row.status === "error" ? row.hits : 0,
        totalHits: row.hits,
        failureRatePct: row.status === "error" ? 100 : 0
      };

      if (row.lastHitAt) {
        initial.lastHitAt = row.lastHitAt;
      }

      grouped.set(row.endpointPath, initial);
      continue;
    }

    if (row.status === "ok") {
      existing.okHits += row.hits;
    } else {
      existing.errorHits += row.hits;
    }

    existing.totalHits += row.hits;

    if (row.lastHitAt && (!existing.lastHitAt || row.lastHitAt > existing.lastHitAt)) {
      existing.lastHitAt = row.lastHitAt;
    }

    existing.failureRatePct =
      existing.totalHits > 0
        ? Number.parseFloat(((existing.errorHits / existing.totalHits) * 100).toFixed(2))
        : 0;
  }

  return [...grouped.values()].sort((left, right) => {
    if (right.totalHits !== left.totalHits) {
      return right.totalHits - left.totalHits;
    }

    return left.legacyVariable.localeCompare(right.legacyVariable);
  });
}

export function getCompatibilityUsageTrend(hours = 24): CompatibilityUsageTrendPoint[] {
  const boundedHours = Number.isFinite(hours) ? Math.max(1, Math.min(hours, 24 * 14)) : 24;
  const minBucket = new Date();
  minBucket.setMinutes(0, 0, 0);
  minBucket.setHours(minBucket.getHours() - boundedHours + 1);

  const byEndpointBucket = new Map<string, CompatibilityUsageTrendPoint>();
  for (const row of usageTrendState.values()) {
    if (new Date(row.bucketStart) < minBucket) {
      continue;
    }

    const key = `${row.endpointPath}|${row.bucketStart}`;
    const existing = byEndpointBucket.get(key) ?? {
      endpointPath: row.endpointPath,
      bucketStart: row.bucketStart,
      okHits: 0,
      errorHits: 0,
      totalHits: 0,
      failureRatePct: 0
    };

    if (row.status === "ok") {
      existing.okHits += row.hits;
    } else {
      existing.errorHits += row.hits;
    }

    existing.totalHits += row.hits;
    existing.failureRatePct =
      existing.totalHits > 0 ? Number.parseFloat(((existing.errorHits / existing.totalHits) * 100).toFixed(2)) : 0;

    byEndpointBucket.set(key, existing);
  }

  return [...byEndpointBucket.values()].sort((left, right) => {
    if (left.endpointPath !== right.endpointPath) {
      return left.endpointPath.localeCompare(right.endpointPath);
    }

    return left.bucketStart.localeCompare(right.bucketStart);
  });
}

export function resetCompatibilityUsageForTests(): void {
  usageState.clear();
  usageTrendState.clear();
}