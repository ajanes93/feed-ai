import { Factory } from "fishery";
import type {
  AIUsageEntry,
  DashboardData,
  ErrorLogEntry,
  SourceHealthEntry,
} from "../composables/useDashboard";

export { digestItemFactory, digestFactory } from "@feed-ai/shared/factories";

export const aiUsageFactory = Factory.define<AIUsageEntry>(({ sequence }) => ({
  id: `call-${sequence}`,
  model: "gemini-2.0-flash",
  provider: "gemini",
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  latencyMs: 2500,
  wasFallback: false,
  error: null,
  status: "success",
  createdAt: 1706443200,
}));

export const sourceHealthFactory = Factory.define<SourceHealthEntry>(
  ({ sequence }) => ({
    sourceId: `source-${sequence}`,
    sourceName: `Source ${sequence}`,
    category: "dev",
    lastSuccessAt: 1706443200,
    lastErrorAt: null,
    lastError: null,
    itemCount: 10,
    consecutiveFailures: 0,
    stale: false,
  })
);

export const errorLogFactory = Factory.define<ErrorLogEntry>(
  ({ sequence }) => ({
    id: `error-${sequence}`,
    level: "error",
    category: "fetch",
    message: `Error ${sequence}`,
    details: null,
    sourceId: null,
    createdAt: 1706443200,
  })
);

export const dashboardDataFactory = Factory.define<DashboardData>(
  ({ params }) => ({
    ai: params.ai ?? {
      recentCalls: [aiUsageFactory.build()],
      totalTokens: 150,
      rateLimitCount: 0,
      fallbackCount: 0,
    },
    sources: params.sources ?? [sourceHealthFactory.build()],
    errors: params.errors ?? [
      errorLogFactory.build({ message: "Connection timeout" }),
    ],
    totalDigests: params.totalDigests ?? 25,
  })
);
