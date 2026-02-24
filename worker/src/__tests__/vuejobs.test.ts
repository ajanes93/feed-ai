import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchVueJobs } from "../services/vuejobs";
import { sourceFactory } from "./factories";

const VUEJOBS_SOURCE = sourceFactory.build({
  id: "vuejobs",
  name: "VueJobs",
  type: "rss",
  url: "https://app.vuejobs.com/feed/posts",
  category: "jobs",
});

function vuejobsRss(
  items: Array<{
    title: string;
    link: string;
    description?: string;
    "content:encoded"?: string;
    pubDate?: string;
  }>
) {
  const itemsXml = items
    .map(
      (item) => `<item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      ${item.description ? `<description>${item.description}</description>` : ""}
      ${item["content:encoded"] ? `<content:encoded><![CDATA[${item["content:encoded"]}]]></content:encoded>` : ""}
      ${item.pubDate ? `<pubDate>${item.pubDate}</pubDate>` : ""}
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>VueJobs</title>${itemsXml}</channel></rss>`;
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchVueJobs", () => {
  it("fetches and maps job listings", async () => {
    fetchMock
      .get("https://app.vuejobs.com")
      .intercept({ method: "GET", path: "/feed/posts" })
      .reply(
        200,
        vuejobsRss([
          {
            title: "Senior Vue.js Engineer (Remote)",
            link: "https://vuejobs.com/jobs/1",
            description: "A remote Vue.js role with TypeScript",
            pubDate: "Mon, 17 Feb 2026 10:00:00 GMT",
          },
        ]),
        { headers: { "content-type": "application/xml" } }
      );

    const items = await fetchVueJobs(VUEJOBS_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Senior Vue.js Engineer (Remote)");
    expect(items[0].link).toBe("https://vuejobs.com/jobs/1");
    expect(items[0].sourceId).toBe("vuejobs");
    expect(items[0].content).toBe("A remote Vue.js role with TypeScript");
  });

  it("includes all jobs without remote filtering", async () => {
    fetchMock
      .get("https://app.vuejobs.com")
      .intercept({ method: "GET", path: "/feed/posts" })
      .reply(
        200,
        vuejobsRss([
          {
            title: "Vue.js Engineer (Remote)",
            link: "https://vuejobs.com/jobs/1",
            description: "Remote position",
          },
          {
            title: "Vue.js Developer — London Office",
            link: "https://vuejobs.com/jobs/2",
            description: "On-site role in London",
          },
          {
            title: "Nuxt Developer",
            link: "https://vuejobs.com/jobs/3",
            description: "Hybrid role in Berlin office",
          },
        ]),
        { headers: { "content-type": "application/xml" } }
      );

    const items = await fetchVueJobs(VUEJOBS_SOURCE);

    expect(items).toHaveLength(3);
  });

  it("returns empty array on HTTP error", async () => {
    fetchMock
      .get("https://app.vuejobs.com")
      .intercept({ method: "GET", path: "/feed/posts" })
      .reply(500, "Server error");

    const items = await fetchVueJobs(VUEJOBS_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array when feed has no items", async () => {
    fetchMock
      .get("https://app.vuejobs.com")
      .intercept({ method: "GET", path: "/feed/posts" })
      .reply(
        200,
        `<?xml version="1.0"?><rss version="2.0"><channel><title>VueJobs</title></channel></rss>`,
        { headers: { "content-type": "application/xml" } }
      );

    const items = await fetchVueJobs(VUEJOBS_SOURCE);

    expect(items).toEqual([]);
  });

  it("handles single item feed (non-array)", async () => {
    fetchMock
      .get("https://app.vuejobs.com")
      .intercept({ method: "GET", path: "/feed/posts" })
      .reply(
        200,
        vuejobsRss([
          {
            title: "Vue Dev",
            link: "https://vuejobs.com/jobs/1",
            description: "A Vue role",
          },
        ]),
        { headers: { "content-type": "application/xml" } }
      );

    const items = await fetchVueJobs(VUEJOBS_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Vue Dev");
  });

  it("strips HTML from content", async () => {
    fetchMock
      .get("https://app.vuejobs.com")
      .intercept({ method: "GET", path: "/feed/posts" })
      .reply(
        200,
        vuejobsRss([
          {
            title: "Vue Engineer",
            link: "https://vuejobs.com/jobs/1",
            "content:encoded":
              "<p>Build <strong>awesome</strong> Vue.js apps &amp; more</p>",
          },
        ]),
        { headers: { "content-type": "application/xml" } }
      );

    const items = await fetchVueJobs(VUEJOBS_SOURCE);

    expect(items[0].content).toBe("Build awesome Vue.js apps & more");
    expect(items[0].content).not.toContain("<");
  });
});
