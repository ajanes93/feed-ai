export type OQPillar =
  | "capability"
  | "labour_market"
  | "sentiment"
  | "industry"
  | "barriers";

export type OQModelAgreement =
  | "agree"
  | "mostly_agree"
  | "disagree"
  | "partial";

export interface OQSignal {
  text: string;
  direction: "up" | "down" | "neutral";
  source: string;
  impact: number;
}

export interface OQPillarScores {
  capability: number;
  labour_market: number;
  sentiment: number;
  industry: number;
  barriers: number;
}

export interface OQModelScore {
  model: string;
  pillar_scores: OQPillarScores;
  technical_delta: number;
  economic_delta: number;
  suggested_delta: number;
  analysis: string;
  top_signals: OQSignal[];
  capability_gap_note?: string;
}

export interface OQScore {
  id: string;
  date: string;
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
  createdAt?: string;
}

export interface OQHistoryEntry {
  date: string;
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  modelSpread: number;
}

export interface OQArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  pillar: OQPillar;
  summary?: string;
  publishedAt: string;
}
