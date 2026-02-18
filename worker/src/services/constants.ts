export const ITEM_LIMIT = 20;
export const USER_AGENT = "feed-ai/1.0";

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePublishedDate(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const timestamp = new Date(dateStr).getTime();
  return isNaN(timestamp) ? undefined : timestamp;
}

export function parseEpochTimestamp(epoch?: number): number | undefined {
  return epoch ? epoch * 1000 : undefined;
}

export const REMOTE_KEYWORDS =
  /\b(remote|anywhere|distributed|work from home|wfh)\b/i;
