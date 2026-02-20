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

export interface OQHistoryEntry {
  date: string;
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  modelSpread: number;
}
