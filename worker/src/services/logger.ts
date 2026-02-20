export type { AIUsageEntry } from "@feed-ai/shared/types";
import type { AIUsageEntry } from "@feed-ai/shared/types";

type LogLevel = "info" | "warn" | "error";
type LogCategory =
  | "ai"
  | "fetch"
  | "parse"
  | "general"
  | "digest"
  | "summarizer";

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, unknown>;
  sourceId?: string;
  digestId?: string;
}

export async function logEvent(db: D1Database, entry: LogEntry) {
  const id = crypto.randomUUID();
  const consoleMethod =
    entry.level === "error" || entry.level === "warn" ? entry.level : "log";
  console[consoleMethod](
    `[${entry.category}] ${entry.message}`,
    entry.details ?? ""
  );

  try {
    await db
      .prepare(
        "INSERT INTO error_logs (id, level, category, message, details, source_id, digest_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        entry.level,
        entry.category,
        entry.message,
        entry.details ? JSON.stringify(entry.details).slice(0, 5000) : null,
        entry.sourceId ?? null,
        entry.digestId ?? null
      )
      .run();
  } catch (err) {
    console.error("Failed to write log entry:", err);
  }
}

export async function recordAIUsage(db: D1Database, usage: AIUsageEntry) {
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        "INSERT INTO ai_usage (id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, error, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        usage.model,
        usage.provider,
        usage.inputTokens ?? null,
        usage.outputTokens ?? null,
        usage.totalTokens ?? null,
        usage.latencyMs ?? null,
        usage.wasFallback ? 1 : 0,
        usage.error ?? null,
        usage.status
      )
      .run();
  } catch (err) {
    console.error("Failed to record AI usage:", err);
  }
}

/**
 * Convenience: log multiple entries in sequence (best-effort).
 * Each entry is written independently so one failure doesn't block the rest.
 */
export async function logEvents(db: D1Database, entries: LogEntry[]) {
  await Promise.allSettled(entries.map((e) => logEvent(db, e)));
}
