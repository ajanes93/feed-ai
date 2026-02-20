import type { OQPillar } from "@feed-ai/shared/oq-types";

interface PromptContext {
  currentScore: number;
  technicalScore: number;
  economicScore: number;
  history: string;
  articlesByPillar: Record<OQPillar, string>;
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
- SWE-bench Verified (curated open-source): ~80%
- SWE-bench Pro (private enterprise code): ~23%
This gap is the story. Movement in Pro matters far more than Verified.

Current score: ${ctx.currentScore}/100
Technical sub-score: ${ctx.technicalScore}/100
Economic sub-score: ${ctx.economicScore}/100
Score history (last 14 days): ${ctx.history}

Today's articles grouped by pillar:

## AI Capability Benchmarks (weight: 25%)
${ctx.articlesByPillar.capability || "No articles today."}

## Labour Market Signals (weight: 25%)
Note: Only flag a labour market AI signal if software job postings are declining FASTER than general postings.
${ctx.articlesByPillar.labour_market || "No articles today."}

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
  "analysis": "<2-3 sentences. Be specific. Reference concrete data. Mention the Capability Gap if relevant. Avoid generic statements.>",
  "capability_gap_note": "<optional: note if SWE-bench Pro or Verified changed today>"
}

CALIBRATION RULES:
- Most days the score should move 0-2 points. 3+ requires landmark news.
- Distinguish between AI *helping* engineers vs AI *replacing* them.
- SWE-bench Verified improvements are less meaningful than Pro improvements.
- CEO hype carries less weight than actual headcount data.
- One company's anecdote doesn't represent the industry.
- "AI tools adopted more" ≠ "engineers being replaced."
- Rising adoption + declining trust = augmentation, not replacement.
- Developers spending more time debugging AI code = score goes DOWN.
- Job market declines only matter if software is falling FASTER than general.

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
