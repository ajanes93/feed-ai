import type { OQPillar } from "@feed-ai/shared/oq-types";
import type { FREDSeriesTrend } from "./fred";

interface SanityHarnessContext {
  topPassRate: number;
  topAgent: string;
  topModel: string;
  medianPassRate: number;
  languageBreakdown: string;
}

interface SWEBenchContext {
  topVerified: number;
  topVerifiedModel: string;
  topBashOnly: number;
  topBashOnlyModel: string;
  topPro?: number;
  topProModel?: string;
}

interface PromptContext {
  currentScore: number;
  technicalScore: number;
  economicScore: number;
  history: string;
  articlesByPillar: Record<OQPillar, string>;
  sanityHarness?: SanityHarnessContext;
  sweBench?: SWEBenchContext;
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDSeriesTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDSeriesTrend;
}

function formatTrend(trend: FREDSeriesTrend): string {
  const parts: string[] = [];
  if (trend.change1w !== undefined) {
    const sign = trend.change1w > 0 ? "+" : "";
    parts.push(`${sign}${trend.change1w}% week-over-week`);
  }
  if (trend.change4w !== undefined) {
    const sign = trend.change4w > 0 ? "+" : "";
    parts.push(`${sign}${trend.change4w}% over 4 weeks`);
  }
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export function buildScoringPrompt(ctx: PromptContext): string {
  return `You are an analyst tracking whether AI will fully replace the median
professional software engineer within the next 10 years.

"Replace" means: AI can independently handle the full role —
understanding business requirements, designing architecture, writing
production code, debugging complex systems, collaborating with
non-technical stakeholders, and maintaining software over time.
A human engineer is no longer needed.

KEY FRAMING: The central metric is the "Capability Gap":
- SWE-bench Verified (best agent+model, curated open-source): ${ctx.sweBench ? `${ctx.sweBench.topVerified}% (${ctx.sweBench.topVerifiedModel})` : "~79%"}
- SWE-bench Bash Only (raw model capability, standardized agent): ${ctx.sweBench ? `${ctx.sweBench.topBashOnly}% (${ctx.sweBench.topBashOnlyModel})` : "~77%"}
- SWE-bench Pro (private codebases, harder problems): ${ctx.sweBench?.topPro ? `${ctx.sweBench.topPro}% (${ctx.sweBench.topProModel})` : "~46%"}
The gap between Verified (~79%) and Pro (~46%) IS the story. Curated open-source benchmarks flatter AI capabilities. Private codebases expose the real gap.

Current score: ${ctx.currentScore}/100
Technical sub-score: ${ctx.technicalScore}/100
Economic sub-score: ${ctx.economicScore}/100
Score history (last 14 days): ${ctx.history}

Today's articles grouped by pillar:

## AI Capability Benchmarks (weight: 25%)
${
  ctx.sanityHarness
    ? `SanityHarness latest data (agent-level benchmarks across 6 languages):
- Top agent pass rate: ${ctx.sanityHarness.topPassRate}% (${ctx.sanityHarness.topAgent} + ${ctx.sanityHarness.topModel})
- Median agent pass rate: ${ctx.sanityHarness.medianPassRate}%
- Language spread (top agent): ${ctx.sanityHarness.languageBreakdown}
- Note: High pass rates on Go/Rust but low on Dart/Zig indicates narrow competence, not general replacement capability.
`
    : ""
}${ctx.articlesByPillar.capability || "No articles today."}

## Labour Market Signals (weight: 25%)
Note: Only flag a labour market AI signal if software job postings are declining FASTER than general postings.
${
  ctx.softwareIndex !== undefined && ctx.generalIndex !== undefined
    ? `Indeed Software Dev Postings Index: ${ctx.softwareIndex}${ctx.softwareDate ? ` (as of ${ctx.softwareDate})` : ""}${ctx.softwareTrend ? formatTrend(ctx.softwareTrend) : ""}. Initial Claims (general labour): ${ctx.generalIndex}${ctx.generalDate ? ` (as of ${ctx.generalDate})` : ""}${ctx.generalTrend ? formatTrend(ctx.generalTrend) : ""}.
`
    : ""
}${ctx.articlesByPillar.labour_market || "No articles today."}

## Developer Sentiment & Adoption (weight: 20%)
Note: Track the "Maintenance Tax" — if developers report spending more time fixing AI-generated code, that signals augmentation problems, not replacement progress. High adoption of broken AI code = score goes DOWN.
${ctx.articlesByPillar.sentiment || "No articles today."}

## Industry & Economic Signals (weight: 20%)
Note: Weight actual headcount data and measurable outcomes higher than CEO hype and VC announcements.
${ctx.articlesByPillar.industry || "No articles today."}

## Structural Barriers (weight: 10%)
${ctx.articlesByPillar.barriers || "No articles today."}

Provide your assessment as JSON:
{
  "pillar_scores": {
    "capability": <-5 to +5>,
    "labour_market": <-5 to +5>,
    "sentiment": <-5 to +5>,
    "industry": <-5 to +5>,
    "barriers": <-5 to +5>
  },
  "technical_delta": <-5 to +5, based on capability + barriers>,
  "economic_delta": <-5 to +5, based on labour + industry + sentiment>,
  "suggested_delta": <-5 to +5, overall>,
  "top_signals": [
    {
      "text": "<one-sentence summary, max 100 chars>",
      "direction": "up" | "down" | "neutral",
      "source": "<publication name>",
      "impact": <-5 to +5>
    }
  ],
  "delta_explanation": "<one sentence explaining what drove the delta, referencing specific signals by name>",
  "analysis": "<2-3 sentences. Be specific. Reference concrete data. Mention the Capability Gap if relevant. Avoid generic statements.>",
  "capability_gap_note": "<optional: note if SWE-bench Verified, Bash Only, or Pro changed today>"
}

IMPORTANT: Return 3-5 top_signals. Fewer than 3 looks broken. Include a mix of up/down/neutral directions.

CALIBRATION RULES:
- Most days the score should move 0-2 points. 3+ requires landmark news.
- Distinguish between AI *helping* engineers vs AI *replacing* them.
- High SWE-bench scores on curated bugs ≠ replacing full engineering roles.
- CEO hype carries less weight than actual headcount data.
- One company's anecdote doesn't represent the industry.
- "AI tools adopted more" ≠ "engineers being replaced."
- Rising adoption + declining trust = augmentation, not replacement.
- Developers spending more time debugging AI code = score goes DOWN.
- Job market declines only matter if software is falling FASTER than general.

ANALYSIS QUALITY RULES:
- Your analysis MUST reference at least 2 specific articles or data points by name.
- Never use phrases like "a mix of" or "remains neutral" without citing why.
- Bad: "The labour market shows mixed signals."
- Good: "Indeed's software posting index dropped 3 points this week while general postings held steady — the first divergence since October."
- Bad: "The AI Capability pillar remains neutral as there is a mix of incremental improvements."
- Good: "SWE-bench Pro holds at ~46%, still far below the 79% Verified score, while SanityHarness median stayed at 50% — agents are good at curated bugs but mediocre at real code."

Return ONLY the JSON object, no other text.`;
}

export async function hashPrompt(prompt: string): Promise<string> {
  const encoded = new TextEncoder().encode(prompt);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
