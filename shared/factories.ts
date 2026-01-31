import { Factory } from "fishery";
import type { Digest, DigestItem } from "./types";

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
