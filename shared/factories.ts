import { Factory } from "fishery";
import type { Digest, DigestItem } from "./types";
import type {
  OQSignal,
  OQModelScore,
  OQPillarScores,
  OQHistoryEntry,
} from "./oq-types";

export const digestItemFactory = Factory.define<DigestItem>(
  ({ sequence }) => ({
    id: `item-${sequence}`,
    category: "ai",
    title: `Item ${sequence}`,
    summary: `Summary ${sequence}`,
    sourceName: `Source ${sequence}`,
    sourceUrl: `https://example.com/${sequence}`,
    position: sequence,
  }),
);

export const digestFactory = Factory.define<Digest>(
  ({ sequence, params }) => {
    const date =
      params.date ?? `2025-01-${String(28 - sequence).padStart(2, "0")}`;
    const items = params.items ?? digestItemFactory.buildList(2);
    return {
      id: `digest-${date}`,
      date,
      itemCount: items.length,
      items,
    };
  },
);

export const oqSignalFactory = Factory.define<OQSignal>(({ sequence }) => ({
  text: `Signal ${sequence}`,
  direction: "up",
  source: `Source ${sequence}`,
  impact: sequence % 5,
}));

export const oqPillarScoresFactory = Factory.define<OQPillarScores>(() => ({
  capability: 0,
  labour_market: 0,
  sentiment: 0,
  industry: 0,
  barriers: 0,
}));

export const oqModelScoreFactory = Factory.define<OQModelScore>(
  ({ sequence }) => ({
    model: `model-${sequence}`,
    pillar_scores: oqPillarScoresFactory.build(),
    technical_delta: 0,
    economic_delta: 0,
    suggested_delta: 0,
    analysis: `Analysis from model ${sequence}`,
    top_signals: [],
  }),
);

export const oqHistoryEntryFactory = Factory.define<OQHistoryEntry>(
  ({ sequence }) => ({
    date: `2025-01-${String(28 - sequence).padStart(2, "0")}`,
    score: 32,
    scoreTechnical: 25,
    scoreEconomic: 38,
    delta: 0,
    modelSpread: 0,
  }),
);
