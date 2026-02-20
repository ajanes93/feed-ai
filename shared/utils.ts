export function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function timeAgo(ts: number | string | null): string {
  if (!ts) return "Never";
  const seconds =
    typeof ts === "string"
      ? Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
      : Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatTokens(n: number | null): string {
  if (n === null || n === undefined) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
