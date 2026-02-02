import { RawItem } from "../../types";

export interface ScrapeHandler {
  /** Parse a fetched Response into raw items */
  parse(response: Response, sourceId: string): Promise<RawItem[]>;
}
