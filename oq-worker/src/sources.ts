import type { OQPillar } from "@feed-ai/shared/oq-types";

export interface OQSource {
  id: string;
  name: string;
  url: string;
  pillar: OQPillar;
  type: "rss" | "hn";
}

export const oqSources: OQSource[] = [
  // === Pillar 1: AI Capability Benchmarks (25%) ===
  {
    id: "oq-anthropic",
    name: "Anthropic Research",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml",
    pillar: "capability",
    type: "rss",
  },
  {
    id: "oq-openai",
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    pillar: "capability",
    type: "rss",
  },
  {
    id: "oq-google-ai",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    pillar: "capability",
    type: "rss",
  },
  {
    id: "oq-huggingface",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    pillar: "capability",
    type: "rss",
  },
  {
    id: "oq-deepmind",
    name: "DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    pillar: "capability",
    type: "rss",
  },
  {
    id: "oq-arxiv-se",
    name: "arXiv Software Engineering",
    url: "http://export.arxiv.org/rss/cs.SE",
    pillar: "capability",
    type: "rss",
  },
  {
    id: "oq-arxiv-ai",
    name: "arXiv AI",
    url: "http://export.arxiv.org/rss/cs.AI",
    pillar: "capability",
    type: "rss",
  },

  // === Pillar 2: Labour Market Signals (25%) ===
  {
    id: "oq-layoffs",
    name: "Layoffs.fyi",
    url: "https://layoffs.fyi/feed/",
    pillar: "labour_market",
    type: "rss",
  },
  {
    id: "oq-hn-hiring",
    name: "HN Who is Hiring",
    url: "https://hnrss.org/newest?q=%22Who+is+hiring%22&points=1",
    pillar: "labour_market",
    type: "hn",
  },

  // === Pillar 3: Developer Sentiment & Adoption (20%) ===
  {
    id: "oq-pragmatic-engineer",
    name: "Pragmatic Engineer",
    url: "https://newsletter.pragmaticengineer.com/feed",
    pillar: "sentiment",
    type: "rss",
  },
  {
    id: "oq-ai-snake-oil",
    name: "AI Snake Oil",
    url: "https://aisnakeoil.substack.com/feed",
    pillar: "sentiment",
    type: "rss",
  },
  {
    id: "oq-simon-willison",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    pillar: "sentiment",
    type: "rss",
  },
  {
    id: "oq-one-useful-thing",
    name: "One Useful Thing",
    url: "https://www.oneusefulthing.org/feed",
    pillar: "sentiment",
    type: "rss",
  },
  {
    id: "oq-github-blog",
    name: "GitHub Blog",
    url: "https://github.blog/feed/",
    pillar: "sentiment",
    type: "rss",
  },
  {
    id: "oq-stackoverflow-blog",
    name: "Stack Overflow Blog",
    url: "https://stackoverflow.blog/feed/",
    pillar: "sentiment",
    type: "rss",
  },

  // === Pillar 4: Industry & Economic Signals (20%) ===
  {
    id: "oq-anthropic-news",
    name: "Anthropic News",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    pillar: "industry",
    type: "rss",
  },
  {
    id: "oq-techcrunch-ai",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    pillar: "industry",
    type: "rss",
  },
  {
    id: "oq-techcrunch-enterprise",
    name: "TechCrunch Enterprise",
    url: "https://techcrunch.com/category/enterprise/feed/",
    pillar: "industry",
    type: "rss",
  },
  {
    id: "oq-cnbc-tech",
    name: "CNBC Technology",
    url: "https://www.cnbc.com/id/19854910/device/rss/rss.html",
    pillar: "industry",
    type: "rss",
  },
  {
    id: "oq-thenewstack",
    name: "The New Stack",
    url: "https://thenewstack.io/feed/",
    pillar: "industry",
    type: "rss",
  },
  {
    id: "oq-arstechnica-ai",
    name: "Ars Technica AI",
    url: "https://arstechnica.com/ai/feed/",
    pillar: "industry",
    type: "rss",
  },
  {
    id: "oq-wired-ai",
    name: "Wired AI",
    url: "https://www.wired.com/feed/tag/ai/latest/rss",
    pillar: "industry",
    type: "rss",
  },

  // === Pillar 5: Structural Barriers (10%) ===
  {
    id: "oq-schneier",
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/",
    pillar: "barriers",
    type: "rss",
  },
  {
    id: "oq-mckinsey",
    name: "McKinsey Insights",
    url: "https://www.mckinsey.com/insights/rss",
    pillar: "barriers",
    type: "rss",
  },
];
