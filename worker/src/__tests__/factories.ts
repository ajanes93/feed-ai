import { Factory } from "fishery";
import type { RawItem } from "../types";
import type { Source } from "../sources";

export const rawItemFactory = Factory.define<RawItem>(({ sequence }) => ({
  id: `item-${sequence}`,
  sourceId: `source-${sequence % 3}`,
  title: `Item ${sequence}`,
  link: `https://example.com/${sequence}`,
  content: `Content for item ${sequence}`,
  publishedAt: Date.now() - sequence * 3600000,
}));

export const sourceFactory = Factory.define<Source>(({ sequence }) => ({
  id: `source-${sequence}`,
  name: `Source ${sequence}`,
  type: "rss",
  url: `https://example.com/feed-${sequence}.xml`,
  category: "dev",
}));
