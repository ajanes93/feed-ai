// Shared structured logger for all feed-ai workers
// Persists log entries to D1 with console fallback
// Each worker configures its own table name and prefix

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  category: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LoggerConfig {
  /** D1 table name (e.g., "error_logs" or "oq_logs") */
  table: string;
  /** Console prefix (e.g., "[worker]" or "[oq]") */
  prefix: string;
}

export class Logger {
  private db: D1Database;
  private config: LoggerConfig;
  private context: Record<string, unknown>;

  constructor(
    db: D1Database,
    config: LoggerConfig,
    context?: Record<string, unknown>
  ) {
    this.db = db;
    this.config = config;
    this.context = context ?? {};
  }

  async info(
    category: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    await this.log({ level: "info", category, message, details });
  }

  async warn(
    category: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    await this.log({ level: "warn", category, message, details });
  }

  async error(
    category: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    await this.log({ level: "error", category, message, details });
  }

  /** Create a child logger with additional context merged into every entry's details */
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.db, this.config, {
      ...this.context,
      ...context,
    });
  }

  private async log(entry: LogEntry): Promise<void> {
    const merged = { ...this.context, ...entry.details };
    const prefix = `${this.config.prefix}:${entry.category}`;

    // Always write to console (Cloudflare dashboard visibility)
    const consoleMethod =
      entry.level === "error" || entry.level === "warn"
        ? entry.level
        : "log";
    console[consoleMethod](
      `[${prefix}]`,
      entry.message,
      Object.keys(merged).length > 0 ? merged : ""
    );

    try {
      await this.db
        .prepare(
          `INSERT INTO ${this.config.table} (id, level, category, message, details) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          entry.level,
          entry.category,
          entry.message,
          Object.keys(merged).length > 0
            ? JSON.stringify(merged).slice(0, 5000)
            : null
        )
        .run();
    } catch (err) {
      console.error(`[${prefix}]`, "DB log write failed:", err);
    }
  }
}
