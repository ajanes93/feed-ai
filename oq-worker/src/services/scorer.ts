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

function truncateStr(value: unknown, maxLen: number): string | undefined {
  return typeof value === "string" ? value.slice(0, maxLen) : undefined;
}

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
    delta_explanation: truncateStr(parsed.delta_explanation, 140),
    capability_gap_note: truncateStr(parsed.capability_gap_note, 300),
    sanity_harness_note: truncateStr(parsed.sanity_harness_note, 300),
    economic_note: truncateStr(parsed.economic_note, 300),
    labour_note: truncateStr(parsed.labour_note, 300),
    model_summary: truncateStr(parsed.model_summary, 200),
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

function normaliseSignalText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // strip parentheticals: "(50% of workforce)"
    .replace(/[\d,]+%?/g, "") // strip numbers and percentages
    .replace(/[^\w\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
    .slice(0, 60);
}

function shortModelLabel(model: string): string {
  if (model.includes("claude")) return "Claude";
  if (model.includes("gpt")) return "GPT-4o";
  if (model.includes("gemini")) return "Gemini";
  return model;
}

function mergeSignals(scores: OQModelScore[]): OQSignal[] {
  const kept = new Map<string, { signal: OQSignal; models: Set<string> }>();

  for (const score of scores) {
    const label = shortModelLabel(score.model);
    for (const signal of score.top_signals) {
      const key = normaliseSignalText(signal.text);
      const existing = kept.get(key);
      if (existing) {
        existing.models.add(label);
      } else {
        kept.set(key, { signal, models: new Set([label]) });
      }
    }
  }

  return [...kept.values()]
    .map(({ signal, models }) => ({
      ...signal,
      models: [...models],
    }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

// --- AI-powered signal deduplication ---

const DIRECTION_SYMBOL: Record<string, string> = { up: "▲", down: "▼" };

interface SignalDedupResult {
  keep: number[];
  /** Groups of indices — first in each group is the keeper. Used to merge model attribution. */
  groups?: number[][];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

async function callGeminiSignalDedup(
  signals: OQSignal[],
  apiKey: string
): Promise<SignalDedupResult> {
  const formatted = signals
    .map(
      (s, i) =>
        `[${i}] ${DIRECTION_SYMBOL[s.direction] ?? "●"} "${s.text}" (impact: ${s.impact}, source: ${s.source})`
    )
    .join("\n");

  const prompt = `You are deduplicating analysis signals from multiple AI models that all analyzed the same news.

Signals:
${formatted}

Group signals that describe the SAME event or data point. From each group, keep the ONE with the clearest, most concrete wording.

RULES:
- Signals with DIFFERENT directions (▲/▼/●) about the same event are intentionally distinct — do NOT group them
- Only group signals that genuinely cover the same specific fact
- Prefer signals with specific numbers and concrete details

Return JSON: { "groups": [[0, 2], [1, 4], [3], [5]] }
Each sub-array is a group of duplicate indices. The FIRST index in each group is the one to keep. Singletons (unique signals) are a group of one.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini dedup error: ${(await res.text()).slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini dedup: empty response");

  const parsed = JSON.parse(
    text
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim()
  );
  const tokenMeta = data?.usageMetadata;

  // Support both response formats: { groups: [[0,2],[1]] } or legacy { keep: [0,1] }
  if (Array.isArray(parsed?.groups)) {
    const groups: number[][] = parsed.groups;
    return {
      keep: groups.map((g: number[]) => g[0]),
      groups,
      inputTokens: tokenMeta?.promptTokenCount,
      outputTokens: tokenMeta?.candidatesTokenCount,
      totalTokens: tokenMeta?.totalTokenCount,
    };
  }

  if (Array.isArray(parsed?.keep)) {
    return {
      keep: parsed.keep,
      inputTokens: tokenMeta?.promptTokenCount,
      outputTokens: tokenMeta?.candidatesTokenCount,
      totalTokens: tokenMeta?.totalTokenCount,
    };
  }

  throw new Error("Gemini dedup: missing groups/keep array");
}

async function deduplicateSignals(
  scores: OQModelScore[],
  geminiApiKey?: string
): Promise<{ signals: OQSignal[]; dedupUsage?: AIUsageEntry }> {
  // Exact dedup first (fast path — catches identical phrasings)
  const preDeduped = mergeSignals(scores);

  if (preDeduped.length === 0) return { signals: [] };

  // AI dedup if Gemini key available and enough signals to be worth it
  if (geminiApiKey && preDeduped.length > 3) {
    const start = Date.now();
    try {
      const result = await callGeminiSignalDedup(preDeduped, geminiApiKey);
      const latencyMs = Date.now() - start;

      // Validate: indices must be in range and unique
      const valid = result.keep.filter(
        (i, pos, arr) =>
          typeof i === "number" &&
          i >= 0 &&
          i < preDeduped.length &&
          arr.indexOf(i) === pos
      );

      // Guard: if AI returns fewer than 2, assume hallucination and fall back
      if (valid.length >= 2) {
        // Merge model attribution from grouped (dropped) signals into keepers
        const keptSignals = valid.map((i) => {
          const signal = { ...preDeduped[i] };
          if (result.groups) {
            const group = result.groups.find((g) => g[0] === i);
            if (group && group.length > 1) {
              const allModels = new Set(signal.models ?? []);
              for (const j of group.slice(1)) {
                if (j >= 0 && j < preDeduped.length) {
                  for (const m of preDeduped[j].models ?? []) allModels.add(m);
                }
              }
              signal.models = [...allModels];
            }
          }
          return signal;
        });
        return {
          signals: keptSignals.sort(
            (a, b) => Math.abs(b.impact) - Math.abs(a.impact)
          ),
          dedupUsage: {
            model: "gemini-2.0-flash",
            provider: "gemini",
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            latencyMs,
            wasFallback: false,
            status: "success",
          },
        };
      }
    } catch {
      // Fall through to exact-deduped result
    }
  }

  return { signals: preDeduped };
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

function synthesizeAnalysis(
  scores: OQModelScore[],
  agreement: OQModelAgreement
): string {
  if (scores.length === 1) return scores[0].analysis;

  if (agreement === "disagree") {
    return scores
      .map((s) => {
        const sign = s.suggested_delta > 0 ? "+" : "";
        return `${formatModelName(s.model)} (${sign}${s.suggested_delta}): ${s.analysis}`;
      })
      .join("\n\n");
  }

  const claude = scores.find((s) => s.model.includes("claude"));
  return claude?.analysis ?? scores[0].analysis;
}

// Prefer Claude's value for a field, fall back to first model that has one
function preferClaude<K extends keyof OQModelScore>(
  scores: OQModelScore[],
  field: K
): OQModelScore[K] | undefined {
  return (
    scores.find((s) => s.model.includes("claude"))?.[field] ??
    scores.find((s) => s[field])?.[field]
  );
}

export {
  parseModelResponse,
  calculateConsensusDelta,
  calculateModelAgreement,
  mergeSignals,
  deduplicateSignals,
  mergePillarScores,
  synthesizeAnalysis,
  preferClaude,
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
  modelSummary?: string;
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
    topPassRateDelta?: number;
    medianPassRateDelta?: number;
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
    proDelta?: number;
    proPrivateDelta?: number;
    verifiedDelta?: number;
    bashOnlyDelta?: number;
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
    topEvent?: { company: string; amount: string; round?: string };
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
      const logFn = isLastAttempt ? log?.error : log?.warn;
      await logFn?.("score", `${name} attempt ${attempt + 1} failed`, details);
      if (!isLastAttempt) {
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
  const { signals, dedupUsage } = await deduplicateSignals(
    scores,
    input.apiKeys.gemini
  );
  if (dedupUsage) aiUsages.push(dedupUsage);
  const pillarScores = mergePillarScores(scores);
  const analysis = synthesizeAnalysis(scores, agreement);

  // Merge capability gap notes
  const gapNotes = scores
    .map((s) => s.capability_gap_note)
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);

  const sanityHarnessNote = preferClaude(scores, "sanity_harness_note");
  const economicNote = preferClaude(scores, "economic_note");
  const labourNote = preferClaude(scores, "labour_note");

  const deltaExplanation = preferClaude(scores, "delta_explanation");
  const modelSummary = preferClaude(scores, "model_summary");

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
    modelSummary: modelSummary || undefined,
    capabilityGap: gapNotes || undefined,
    sanityHarnessNote: sanityHarnessNote || undefined,
    economicNote: economicNote || undefined,
    labourNote: labourNote || undefined,
    promptHash,
    promptText: prompt,
    aiUsages,
  };
}
