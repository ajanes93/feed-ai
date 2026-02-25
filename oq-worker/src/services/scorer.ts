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
import type { FREDSeriesTrend } from "./fred";

// --- Model calling ---

interface ModelResult {
  parsed: OQModelScore;
  rawResponse: string;
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
    rawResponse: text,
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
    rawResponse: content.text,
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
    rawResponse: text,
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
    top_signals: (parsed.top_signals ?? []).map(
      (s: Record<string, unknown>) => ({
        text: s.text,
        direction: s.direction,
        source: s.source,
        impact: s.impact,
        ...(typeof s.url === "string" && /^https?:\/\//.test(s.url)
          ? { url: s.url }
          : {}),
      })
    ) as OQSignal[],
    delta_explanation:
      typeof parsed.delta_explanation === "string"
        ? parsed.delta_explanation.slice(0, 200)
        : undefined,
    capability_gap_note: parsed.capability_gap_note,
    sanity_harness_note:
      typeof parsed.sanity_harness_note === "string"
        ? parsed.sanity_harness_note.slice(0, 300)
        : undefined,
    economic_note:
      typeof parsed.economic_note === "string"
        ? parsed.economic_note.slice(0, 300)
        : undefined,
    labour_note:
      typeof parsed.labour_note === "string"
        ? parsed.labour_note.slice(0, 300)
        : undefined,
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
  // Match sentence-ending punctuation, but skip decimal numbers (e.g. GPT-5.3, 46.2%)
  // and common abbreviations (e.g. vs., etc., Dr.)
  const match = text.match(
    /^.+?(?<!\d)(?<!\bvs)(?<!\betc)(?<!\bDr)[.!?](?:\s|$)/
  );
  if (match) return match[0].trim();
  return text.length > 200 ? text.slice(0, 200) + "..." : text;
}

function synthesizeAnalysis(
  scores: OQModelScore[],
  agreement: OQModelAgreement
): string {
  if (scores.length === 1) return scores[0].analysis;

  if (agreement === "disagree") {
    return scores
      .map((s) => {
        const sign = s.suggested_delta > 0 ? "+" : "";
        return `${formatModelName(s.model)} ${deltaVerb(s.suggested_delta)} (${sign}${s.suggested_delta}), citing: ${firstSentence(s.analysis)}`;
      })
      .join(" ");
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

export interface OQModelResponse {
  model: string;
  provider: string;
  rawResponse: string;
  parsed: OQModelScore;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

export interface OQScoringResult {
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  deltaExplanation?: string;
  analysis: string;
  signals: OQSignal[];
  pillarScores: OQPillarScores;
  modelScores: OQModelScore[];
  modelResponses: OQModelResponse[];
  modelAgreement: OQModelAgreement;
  modelSpread: number;
  capabilityGap?: string;
  sanityHarnessNote?: string;
  economicNote?: string;
  labourNote?: string;
  promptHash: string;
  promptText: string;
  aiUsages: AIUsageEntry[];
}

interface ScorerLogger {
  warn: (
    category: string,
    message: string,
    details?: Record<string, unknown>
  ) => Promise<void>;
  error: (
    category: string,
    message: string,
    details?: Record<string, unknown>
  ) => Promise<void>;
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
  sweBench?: {
    topVerified: number;
    topVerifiedModel: string;
    topBashOnly: number;
    topBashOnlyModel: string;
    topPro?: number;
    topProModel?: string;
    topProPrivate?: number;
    topProPrivateModel?: string;
  };
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDSeriesTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDSeriesTrend;
  fundingSummary?: {
    totalRaised: string;
    count: number;
    topRound?: { company: string; amount: string; round?: string };
  };
  log?: ScorerLogger;
}

const MAX_RETRIES = 3;

interface ModelCallResult {
  result: ModelResult | null;
  failedUsage?: AIUsageEntry;
}

async function callModelWithRetry(
  name: string,
  model: string,
  provider: string,
  fn: () => Promise<ModelResult>,
  log?: ScorerLogger
): Promise<ModelCallResult> {
  let lastError: string | undefined;
  const start = Date.now();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return { result: await fn() };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      const details = {
        model,
        provider,
        attempt: attempt + 1,
        error: lastError,
      };
      if (isLastAttempt) {
        await log?.error(
          "score",
          `${name} attempt ${attempt + 1} failed`,
          details
        );
      } else {
        await log?.warn(
          "score",
          `${name} attempt ${attempt + 1} failed`,
          details
        );
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  return {
    result: null,
    failedUsage: {
      model,
      provider,
      latencyMs: Date.now() - start,
      wasFallback: false,
      status: "failed",
      error: lastError,
    },
  };
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
    sweBench: input.sweBench,
    softwareIndex: input.softwareIndex,
    softwareDate: input.softwareDate,
    softwareTrend: input.softwareTrend,
    generalIndex: input.generalIndex,
    generalDate: input.generalDate,
    generalTrend: input.generalTrend,
    fundingSummary: input.fundingSummary,
  });

  const promptHash = await hashPrompt(prompt);

  const calls: Promise<ModelCallResult>[] = [];

  if (input.apiKeys.anthropic) {
    calls.push(
      callModelWithRetry(
        "Claude",
        "claude-sonnet-4-5-20250929",
        "anthropic",
        () => callClaude(prompt, input.apiKeys.anthropic!),
        input.log
      )
    );
  }
  if (input.apiKeys.openai) {
    calls.push(
      callModelWithRetry(
        "GPT-4",
        "gpt-4o",
        "openai",
        () => callOpenAI(prompt, input.apiKeys.openai!),
        input.log
      )
    );
  }
  if (input.apiKeys.gemini) {
    calls.push(
      callModelWithRetry(
        "Gemini",
        "gemini-2.0-flash",
        "gemini",
        () => callGemini(prompt, input.apiKeys.gemini!),
        input.log
      )
    );
  }

  const callResults = await Promise.all(calls);
  const modelResults = callResults
    .map((r) => r.result)
    .filter((r): r is ModelResult => r !== null);

  const aiUsages: AIUsageEntry[] = [
    ...modelResults.map((r) => r.usage),
    ...callResults.flatMap((r) => (r.failedUsage ? [r.failedUsage] : [])),
  ];

  if (modelResults.length === 0) {
    throw new Error("All AI models failed — cannot generate score");
  }

  const scores = modelResults.map((r) => r.parsed);
  const modelResponses: OQModelResponse[] = modelResults.map((r) => ({
    model: r.usage.model,
    provider: r.usage.provider,
    rawResponse: r.rawResponse,
    parsed: r.parsed,
    inputTokens: r.usage.inputTokens,
    outputTokens: r.usage.outputTokens,
    latencyMs: r.usage.latencyMs,
  }));

  // Dampen a raw delta: clamp to ±cap, multiply by 0.3, round to 1dp
  const dampen = (raw: number, cap = 1.2) =>
    Math.round(Math.max(-cap, Math.min(cap, raw * 0.3)) * 10) / 10;

  // Consensus calculation
  const consensusDelta = calculateConsensusDelta(scores);
  const preDampened = Math.max(-4, Math.min(4, consensusDelta));
  const finalDelta = dampen(preDampened, 1.2);

  // Calculate sub-score deltas
  const avg = (fn: (s: OQModelScore) => number) =>
    scores.reduce((sum, s) => sum + fn(s), 0) / scores.length;
  const techDelta = dampen(avg((s) => s.technical_delta));
  const econDelta = dampen(avg((s) => s.economic_delta));

  const clampScore = (prev: number, delta: number) =>
    Math.round(Math.max(5, Math.min(95, prev + delta)) * 10) / 10;

  const newScore = clampScore(input.previousScore, finalDelta);
  const newTechnical = clampScore(input.previousTechnical, techDelta);
  const newEconomic = clampScore(input.previousEconomic, econDelta);

  const { agreement, spread } = calculateModelAgreement(scores);
  const signals = mergeSignals(scores);
  const pillarScores = mergePillarScores(scores);
  const analysis = synthesizeAnalysis(scores, agreement);

  // Prefer Claude's value for a field, fall back to first model that has one
  const preferClaude = <K extends keyof OQModelScore>(field: K) =>
    scores.find((s) => s.model.includes("claude"))?.[field] ??
    scores.find((s) => s[field])?.[field];

  // Merge capability gap notes
  const gapNotes = scores
    .map((s) => s.capability_gap_note)
    .filter(Boolean)
    .join(" ");

  const sanityHarnessNote = preferClaude("sanity_harness_note");
  const economicNote = preferClaude("economic_note");
  const labourNote = preferClaude("labour_note");

  const deltaExplanation = preferClaude("delta_explanation");

  return {
    score: newScore,
    scoreTechnical: newTechnical,
    scoreEconomic: newEconomic,
    delta: finalDelta,
    deltaExplanation: deltaExplanation || undefined,
    analysis,
    signals,
    pillarScores,
    modelScores: scores,
    modelResponses,
    modelAgreement: agreement,
    modelSpread: Math.round(spread * 10) / 10,
    capabilityGap: gapNotes || undefined,
    sanityHarnessNote: sanityHarnessNote || undefined,
    economicNote: economicNote || undefined,
    labourNote: labourNote || undefined,
    promptHash,
    promptText: prompt,
    aiUsages,
  };
}
