import type { CompatibilityUsageEntry } from "./compatibilityUsage";
import type { CompatibilityStatus, GtmCompatibilityEntry } from "./gtmCompatibilityMatrix";

export type CompatibilityFailureDiagnostic = {
  priority: GtmCompatibilityEntry["priority"];
  legacyVariable: string;
  endpointPath: string;
  status: CompatibilityStatus;
  externalRefs: number;
  okHits: number;
  errorHits: number;
  totalHits: number;
  failureRatePct: number;
  eventFamilies: string[];
  reason: string;
};

function getReason(status: CompatibilityStatus, errorHits: number): string {
  if (status === "missing") {
    return "No compatibility endpoint exists yet for this Elevar placeholder family.";
  }

  if (status === "partial") {
    return "Endpoint exists but translation parity is still partial for some vendor tag placeholders.";
  }

  if (errorHits > 0) {
    return "Resolver is available but returning errors for some requests; validate input shape and required query fields.";
  }

  return "Resolver is healthy and serving successful lookups.";
}

export function buildCompatibilityFailureDiagnostics(input: {
  matrix: GtmCompatibilityEntry[];
  usage: CompatibilityUsageEntry[];
  limit?: number;
}): CompatibilityFailureDiagnostic[] {
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(input.limit ?? 5, 25)) : 5;

  const usageByEndpoint = new Map<string, { okHits: number; errorHits: number }>();
  for (const row of input.usage) {
    const existing = usageByEndpoint.get(row.endpointPath) ?? { okHits: 0, errorHits: 0 };
    if (row.status === "ok") {
      existing.okHits += row.hits;
    } else {
      existing.errorHits += row.hits;
    }

    usageByEndpoint.set(row.endpointPath, existing);
  }

  const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

  return input.matrix
    .filter((entry) => entry.endpointPath)
    .map((entry) => {
      const endpointPath = entry.endpointPath as string;
      const hits = usageByEndpoint.get(endpointPath) ?? { okHits: 0, errorHits: 0 };
      const totalHits = hits.okHits + hits.errorHits;
      const failureRatePct = totalHits > 0 ? Number.parseFloat(((hits.errorHits / totalHits) * 100).toFixed(2)) : 0;

      return {
        priority: entry.priority,
        legacyVariable: entry.legacyVariable,
        endpointPath,
        status: entry.status,
        externalRefs: entry.externalRefs,
        okHits: hits.okHits,
        errorHits: hits.errorHits,
        totalHits,
        failureRatePct,
        eventFamilies: entry.eventFamilies,
        reason: getReason(entry.status, hits.errorHits)
      };
    })
    .filter((row) => row.status !== "available" || row.errorHits > 0)
    .sort((left, right) => {
      if (left.status !== right.status) {
        const statusRank = { missing: 0, partial: 1, available: 2 } as const;
        return statusRank[left.status] - statusRank[right.status];
      }

      const byPriority = priorityRank[left.priority] - priorityRank[right.priority];
      if (byPriority !== 0) {
        return byPriority;
      }

      if (right.errorHits !== left.errorHits) {
        return right.errorHits - left.errorHits;
      }

      if (right.failureRatePct !== left.failureRatePct) {
        return right.failureRatePct - left.failureRatePct;
      }

      return right.externalRefs - left.externalRefs;
    })
    .slice(0, limit);
}
