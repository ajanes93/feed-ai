import type { OQPillar } from "@feed-ai/shared/oq-types";
import type { FREDSeriesTrend } from "./fred";

interface SanityHarnessContext {
  topPassRate: number;
  topAgent: string;
  topModel: string;
  medianPassRate: number;
  languageBreakdown: string;
  topPassRateDelta?: number;
  medianPassRateDelta?: number;
}

interface SWEBenchContext {
  topVerified: number;
  topVerifiedModel: string;
  topBashOnly: number;
  topBashOnlyModel: string;
  topPro?: number;
  topProModel?: string;
  topProPrivate?: number;
  topProPrivateModel?: string;
  verifiedDeprecated?: boolean;
  proDelta?: number;
  proPrivateDelta?: number;
  verifiedDelta?: number;
  bashOnlyDelta?: number;
}

interface FundingContext {
  totalRaised: string;
  count: number;
  topEvent?: { company: string; amount: string; round?: string };
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
  fundingSummary?: FundingContext;
}

function formatTrend(trend: FREDSeriesTrend): string {
  const sign = (n: number) => (n > 0 ? "+" : "");
  const parts = [
    trend.change1w !== undefined
      ? `${sign(trend.change1w)}${trend.change1w}% week-over-week`
      : null,
    trend.change4w !== undefined
      ? `${sign(trend.change4w)}${trend.change4w}% over 4 weeks`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) return "";
  if (delta === 0) return " [unchanged]";
  const sign = delta > 0 ? "+" : "";
  return ` [${sign}${delta}pp since last fetch]`;
}

function fmtSwe(
  value: number | undefined,
  model: string | undefined,
  delta: number | undefined,
  fallback: string
): string {
  return value ? `${value}% (${model})${formatDelta(delta)}` : fallback;
}

export function buildScoringPrompt(ctx: PromptContext): string {
  return `You are an analyst tracking whether AI will fully replace the median
professional software engineer within the next 10 years.

"Replace" means: AI can independently handle the full role —
understanding business requirements, designing architecture, writing
production code, debugging complex systems, collaborating with
non-technical stakeholders, and maintaining software over time.
A human engineer is no longer needed.

BENCHMARK UPDATE (Feb 23, 2026): OpenAI deprecated SWE-bench Verified.
Confirmed contamination — models can reproduce gold patches from memory.
59.4% of hard tasks have flawed tests rejecting correct solutions.
SWE-bench Pro (Scale AI) is now the industry standard.

Note: LessWrong audit (Feb 24) found SWE-bench Pro also has issues
(test leniency, requirements inflation). No benchmark is perfect —
which is why we track multiple independent sources.

KEY FRAMING: The central metric is the "Capability Gap":
- SWE-bench Pro Public (unfamiliar real-world repos, Scale AI SEAL): ${fmtSwe(ctx.sweBench?.topPro, ctx.sweBench?.topProModel, ctx.sweBench?.proDelta, "~46%")}
- SWE-bench Pro Private (truly private startup codebases, Scale AI SEAL): ${fmtSwe(ctx.sweBench?.topProPrivate, ctx.sweBench?.topProPrivateModel, ctx.sweBench?.proPrivateDelta, "~23%")}
- SWE-bench Verified (DEPRECATED — contamination confirmed): ${ctx.sweBench ? `${ctx.sweBench.topVerified}% (${ctx.sweBench.topVerifiedModel})${formatDelta(ctx.sweBench.verifiedDelta)}` : "~79%"}
- SWE-bench Bash Only (raw model capability, standardized agent): ${ctx.sweBench ? `${ctx.sweBench.topBashOnly}% (${ctx.sweBench.topBashOnlyModel})${formatDelta(ctx.sweBench.bashOnlyDelta)}` : "~77%"}
The honest numbers are Pro Public (~46%) and Pro Private (~23%). Verified scores are inflated by memorisation and should NOT be cited as evidence of capability. On private codebases it drops to ~23%.

Current score: ${ctx.currentScore}/100
Technical sub-score: ${ctx.technicalScore}/100
Economic sub-score: ${ctx.economicScore}/100
Score history (last 14 days): ${ctx.history}

STANDING EVIDENCE (already priced into the current score — do NOT treat as new information or re-weight as today's signal):
- CEPR/BIS/EIB study (Feb 2026): 12,000+ European firms, AI adoption → +4% productivity, zero job losses, 5.9x training ROI. Evidence of augmentation, not displacement.

Today's articles grouped by pillar:

## AI Capability Benchmarks (weight: 25%)
${
  ctx.sanityHarness
    ? `SanityHarness latest data (agent-level benchmarks across 6 languages):
- Top agent pass rate: ${ctx.sanityHarness.topPassRate}% (${ctx.sanityHarness.topAgent} + ${ctx.sanityHarness.topModel})${formatDelta(ctx.sanityHarness.topPassRateDelta)}
- Median agent pass rate: ${ctx.sanityHarness.medianPassRate}%${formatDelta(ctx.sanityHarness.medianPassRateDelta)}
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
${
  ctx.fundingSummary && ctx.fundingSummary.totalRaised !== "$0"
    ? `Recent AI Spending: ${ctx.fundingSummary.totalRaised} across ${ctx.fundingSummary.count} event(s)${ctx.fundingSummary.topEvent ? ` (top: ${ctx.fundingSummary.topEvent.company} ${ctx.fundingSummary.topEvent.amount})` : ""}.
`
    : ""
}${ctx.articlesByPillar.industry || "No articles today."}

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
      "impact": <-5 to +5>,
      "url": "<REQUIRED: article URL from [url] tag, or source URL for data signals (https://www.swebench.com for SWE-bench, https://sanityboard.lr7.dev for SanityHarness, https://fred.stlouisfed.org for FRED/Indeed data)>"
    }
  ],
  "delta_explanation": "<max 140 characters. Lead with the most important change. Concrete, no hedge words.>",
  "analysis": "<2-3 punchy sentences as a sharp briefing. Use concrete numbers. No hedge words (suggests, indicates, represents). Write for an engineer scanning this over coffee.>",
  "capability_gap_note": "<optional: note if SWE-bench Verified, Bash Only, or Pro changed today>",
  "sanity_harness_note": "<optional: one-sentence interpretation of today's SanityHarness agent benchmark data — language spread, top agent performance, what it means for replacement>",
  "economic_note": "<optional: one-sentence interpretation of today's economic signals — Indeed index trend, funding activity, hiring/layoff patterns>",
  "labour_note": "<optional: one sentence about software vs. general job posting divergence — only include if the data shows meaningful divergence>",
  "model_summary": "<REQUIRED: one sentence (max 30 words) summarising the consensus or disagreement across models. If models agree, state the consensus view. If they disagree, state WHAT they disagree on, not just that they disagree. Do not name individual models.>"
}

IMPORTANT: Return 3-5 top_signals. Fewer than 3 looks broken. Include a mix of up/down/neutral directions.
Each signal should describe a DISTINCT piece of evidence. If one event has opposing implications
(e.g. a layoff is ▲ for replacement likelihood but ▼ because it's isolated), phrase each signal
to clearly distinguish the aspect: "Block cuts 50% workforce citing AI" (▲) vs
"Block layoff is isolated — software hiring still up 4.1%" (▼).

CALIBRATION RULES:
- Most days the score should move 0-2 points. 3+ requires landmark news.
- Data marked [unchanged] is already reflected in the current score — zero delta contribution.
- Standing evidence is baseline context, not a daily signal. Only new articles or data changes should drive deltas.
- Distinguish between AI *helping* engineers vs AI *replacing* them.
- High SWE-bench scores on curated bugs ≠ replacing full engineering roles.
- CEO hype carries less weight than actual headcount data.
- One company's anecdote doesn't represent the industry.
- "AI tools adopted more" ≠ "engineers being replaced."
- Rising adoption + declining trust = augmentation, not replacement.
- Developers spending more time debugging AI code = score goes DOWN.
- Job market declines only matter if software is falling FASTER than general.

ANALYSIS QUALITY RULES:
- Write as a sharp briefing, not an academic paper.
- Lead with the most important development in one punchy sentence.
- Then 1-2 sentences of context with concrete numbers.
- Reference at least 2 specific data points by name.
- NEVER use: "suggests", "indicates", "represents", "a mix of", "remains neutral".
- Bad: "Block's 4,000-person layoff explicitly citing AI adoption represents the most significant AI-driven headcount reduction to date, but the signal is muddied by Indeed software postings growing 4.1%."
- Good: "Block cut half its workforce and blamed AI — the biggest AI-driven layoff yet. But software job postings are actually up 4.1% this month. One company restructuring doesn't make a trend."

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
