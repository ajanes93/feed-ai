import { RawItem } from "../../types";
import { ITEM_LIMIT } from "../constants";
import { ScrapeHandler } from "./types";

const BASE_URL = "https://every.to";

function isArticlePath(href: string): boolean {
  return href.startsWith("/") && href.split("/").length > 2;
}

export const everyToScraper: ScrapeHandler = {
  async parse(response, sourceId) {
    const seen = new Set<string>();
    const items: RawItem[] = [];
    let currentHref: string | null = null;
    let capturingTitle = false;
    let titleText = "";

    const rewriter = new HTMLRewriter()
      .on("a[href]", {
        element(el) {
          currentHref = el.getAttribute("href");
        },
      })
      .on("h3", {
        element(el) {
          if (currentHref) {
            capturingTitle = true;
            titleText = "";
          }

          el.onEndTag(() => {
            if (!capturingTitle || !currentHref) return;
            capturingTitle = false;

            const title = titleText.trim();
            const href = currentHref;
            currentHref = null;

            if (!title || !isArticlePath(href) || seen.has(href)) return;
            if (items.length >= ITEM_LIMIT) return;
            seen.add(href);

            items.push({
              id: crypto.randomUUID(),
              sourceId,
              title,
              link: `${BASE_URL}${href}`,
            });
          });
        },
        text(chunk) {
          if (capturingTitle) {
            titleText += chunk.text;
          }
        },
      });

    await rewriter.transform(response).text();

    return items;
  },
};
