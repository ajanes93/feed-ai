import Anthropic from "@anthropic-ai/sdk";
import type {
  OQPillar,
  OQModelScore,
  OQPillarScores,
  OQSignal,
  OQModelAgreement,
} from "@feed-ai/shared/oq-types";
import { buildScoringPrompt, hashPrompt } from "./prompt";
import type { AIUsageEntry } from "@feed-ai/shared/types";

// --- Model calling ---

interface ModelResult {
  parsed: OQModelScore;
  usage: AIUsageEntry;
}

async function callGemini(
  prompt: string,
  apiKey: string
): Promise<ModelResult> {
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gemini-2.0-flash error: ${body.slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("gemini-2.0-flash error: Empty response");
  }

  const tokenMeta = data?.usageMetadata;
  const parsed = parseModelResponse(text, "gemini-2.0-flash");

  return {
    parsed,
    usage: {
      model: "gemini-2.0-flash",
      provider: "gemini",
      inputTokens: tokenMeta?.promptTokenCount,
      outputTokens: tokenMeta?.candidatesTokenCount,
      totalTokens: tokenMeta?.totalTokenCount,
      latencyMs,
      wasFallback: false,
      status: "success",
    },
  };
}

async function callClaude(
  prompt: string,
  apiKey: string
): Promise<ModelResult> {
  const start = Date.now();
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const latencyMs = Date.now() - start;

  const content = response.content[0];
  if (!content || content.type !== "text") {
    throw new Error("claude-sonnet-4-5-20250929 error: Empty response");
  }

  const parsed = parseModelResponse(content.text, "claude-sonnet-4-5-20250929");

  return {
    parsed,
    usage: {
      model: "claude-sonnet-4-5-20250929",
      provider: "anthropic",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs,
      wasFallback: false,
      status: "success",
    },
  };
}

async function callOpenAI(
  prompt: string,
  apiKey: string
): Promise<ModelResult> {
  const start = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gpt-4o error: ${body.slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("gpt-4o error: Empty response");
  }

  const parsed = parseModelResponse(text, "gpt-4o");

  return {
    parsed,
    usage: {
      model: "gpt-4o",
      provider: "openai",
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
      totalTokens: data?.usage?.total_tokens,
      latencyMs,
      wasFallback: false,
      status: "success",
    },
  };
}

// --- Parsing ---

function parseModelResponse(text: string, model: string): OQModelScore {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  if (
    !parsed.pillar_scores ||
    typeof parsed.suggested_delta !== "number" ||
    !parsed.analysis
  ) {
    throw new Error(`Invalid response structure from ${model}`);
  }

  return {
    model,
    pillar_scores: parsed.pillar_scores as OQPillarScores,
    technical_delta: parsed.technical_delta ?? 0,
    economic_delta: parsed.economic_delta ?? 0,
    suggested_delta: parsed.suggested_delta,
    analysis: parsed.analysis,
    top_signals: (parsed.top_signals ?? []) as OQSignal[],
    capability_gap_note: parsed.capability_gap_note,
  };
}

// --- Consensus calculation ---

const MODEL_WEIGHTS = {
  claude: 0.4,
  gpt4: 0.3,
  gemini: 0.3,
};

function calculateConsensusDelta(scores: OQModelScore[]): number {
  if (scores.length === 0) return 0;
  if (scores.length === 1) return scores[0].suggested_delta;

  let total = 0;
  let weightSum = 0;
  for (const score of scores) {
    const w = score.model.includes("claude")
      ? MODEL_WEIGHTS.claude
      : score.model.includes("gpt")
        ? MODEL_WEIGHTS.gpt4
        : MODEL_WEIGHTS.gemini;
    total += score.suggested_delta * w;
    weightSum += w;
  }

  return total / weightSum;
}

function calculateModelAgreement(scores: OQModelScore[]): {
  agreement: OQModelAgreement;
  spread: number;
} {
  if (scores.length < 2) return { agreement: "partial", spread: 0 };

  const deltas = scores.map((s) => s.suggested_delta);
  const spread = Math.max(...deltas) - Math.min(...deltas);

  if (spread < 1.0) return { agreement: "agree", spread };
  if (spread <= 2.5) return { agreement: "mostly_agree", spread };
  return { agreement: "disagree", spread };
}

function mergeSignals(scores: OQModelScore[]): OQSignal[] {
  const seen = new Set<string>();
  const signals: OQSignal[] = [];

  for (const score of scores) {
    for (const signal of score.top_signals) {
      const key = signal.text.toLowerCase().slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        signals.push(signal);
      }
    }
  }

  // Sort by absolute impact
  return signals.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function mergePillarScores(scores: OQModelScore[]): OQPillarScores {
  const pillars: OQPillar[] = [
    "capability",
    "labour_market",
    "sentiment",
    "industry",
    "barriers",
  ];
  const result = {} as OQPillarScores;

  for (const pillar of pillars) {
    const values = scores.map((s) => s.pillar_scores[pillar]);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    result[pillar] = Math.round(avg * 10) / 10;
  }

  return result;
}

function formatModelName(model: string): string {
  if (model.includes("claude")) return "Claude";
  if (model.includes("gpt")) return "GPT-4";
  if (model.includes("gemini")) return "Gemini";
  return model.split("-")[0];
}

function deltaVerb(delta: number): string {
  if (delta > 0.5) return "upgraded the score";
  if (delta < -0.5) return "downgraded the score";
  return "held steady";
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 120);
}

function synthesizeAnalysis(
  scores: OQModelScore[],
  agreement: OQModelAgreement
): string {
  if (scores.length === 1) return scores[0].analysis;

  if (agreement === "disagree") {
    const parts = scores.map((s) => {
      const name = formatModelName(s.model);
      const verb = deltaVerb(s.suggested_delta);
      const delta = s.suggested_delta > 0 ? `+${s.suggested_delta}` : `${s.suggested_delta}`;
      const cite = firstSentence(s.analysis);
      return `${name} ${verb} (${delta}), citing: ${cite}`;
    });
    return parts.join(" ");
  }

  const claude = scores.find((s) => s.model.includes("claude"));
  return claude?.analysis ?? scores[0].analysis;
}

export {
  parseModelResponse,
  calculateConsensusDelta,
  calculateModelAgreement,
  mergeSignals,
  mergePillarScores,
  synthesizeAnalysis,
};

// --- Main scoring pipeline ---

export interface OQScoringResult {
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  analysis: string;
  signals: OQSignal[];
  pillarScores: OQPillarScores;
  modelScores: OQModelScore[];
  modelAgreement: OQModelAgreement;
  modelSpread: number;
  capabilityGap?: string;
  promptHash: string;
  aiUsages: AIUsageEntry[];
}

interface ScoringInput {
  previousScore: number;
  previousTechnical: number;
  previousEconomic: number;
  history: string;
  articlesByPillar: Record<OQPillar, string>;
  apiKeys: {
    anthropic?: string;
    gemini?: string;
    openai?: string;
  };
  sanityHarness?: {
    topPassRate: number;
    topAgent: string;
    topModel: string;
    medianPassRate: number;
    languageBreakdown: string;
  };
  softwareIndex?: number;
  generalIndex?: number;
}

const MAX_RETRIES = 3;

async function callModelWithRetry(
  name: string,
  fn: () => Promise<ModelResult>
): Promise<ModelResult | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`${name} attempt ${attempt + 1} failed:`, err);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  return null;
}

export async function runScoring(
  input: ScoringInput
): Promise<OQScoringResult> {
  const prompt = buildScoringPrompt({
    currentScore: input.previousScore,
    technicalScore: input.previousTechnical,
    economicScore: input.previousEconomic,
    history: input.history,
    articlesByPillar: input.articlesByPillar,
    sanityHarness: input.sanityHarness,
    softwareIndex: input.softwareIndex,
    generalIndex: input.generalIndex,
  });

  const promptHash = await hashPrompt(prompt);

  const calls: Promise<ModelResult | null>[] = [];

  if (input.apiKeys.anthropic) {
    calls.push(
      callModelWithRetry("Claude", () =>
        callClaude(prompt, input.apiKeys.anthropic!)
      )
    );
  }
  if (input.apiKeys.openai) {
    calls.push(
      callModelWithRetry("GPT-4", () =>
        callOpenAI(prompt, input.apiKeys.openai!)
      )
    );
  }
  if (input.apiKeys.gemini) {
    calls.push(
      callModelWithRetry("Gemini", () =>
        callGemini(prompt, input.apiKeys.gemini!)
      )
    );
  }

  const modelResults = (await Promise.all(calls)).filter(
    (r): r is ModelResult => r !== null
  );

  if (modelResults.length === 0) {
    throw new Error("All AI models failed — cannot generate score");
  }

  const scores = modelResults.map((r) => r.parsed);
  const aiUsages = modelResults.map((r) => r.usage);

  // Consensus calculation
  const consensusDelta = calculateConsensusDelta(scores);
  const clampedDelta = Math.max(-4, Math.min(4, consensusDelta));
  const dampened = clampedDelta * 0.3;
  const finalDelta =
    Math.round(Math.max(-1.2, Math.min(1.2, dampened)) * 10) / 10;

  // Calculate sub-score deltas
  const avgTechnicalDelta =
    scores.reduce((sum, s) => sum + s.technical_delta, 0) / scores.length;
  const avgEconomicDelta =
    scores.reduce((sum, s) => sum + s.economic_delta, 0) / scores.length;

  const techDelta =
    Math.round(Math.max(-1.2, Math.min(1.2, avgTechnicalDelta * 0.3)) * 10) /
    10;
  const econDelta =
    Math.round(Math.max(-1.2, Math.min(1.2, avgEconomicDelta * 0.3)) * 10) / 10;

  const newScore = Math.round(
    Math.max(5, Math.min(95, input.previousScore + finalDelta))
  );
  const newTechnical = Math.round(
    Math.max(5, Math.min(95, input.previousTechnical + techDelta))
  );
  const newEconomic = Math.round(
    Math.max(5, Math.min(95, input.previousEconomic + econDelta))
  );

  const { agreement, spread } = calculateModelAgreement(scores);
  const signals = mergeSignals(scores);
  const pillarScores = mergePillarScores(scores);
  const analysis = synthesizeAnalysis(scores, agreement);

  // Merge capability gap notes
  const gapNotes = scores
    .map((s) => s.capability_gap_note)
    .filter(Boolean)
    .join(" ");

  return {
    score: newScore,
    scoreTechnical: newTechnical,
    scoreEconomic: newEconomic,
    delta: finalDelta,
    analysis,
    signals,
    pillarScores,
    modelScores: scores,
    modelAgreement: agreement,
    modelSpread: Math.round(spread * 10) / 10,
    capabilityGap: gapNotes || undefined,
    promptHash,
    aiUsages,
  };
}
