export function timeAgo(unixTs: number | null): string {
  if (!unixTs) return "Never";
  const seconds = Math.floor(Date.now() / 1000 - unixTs);
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
