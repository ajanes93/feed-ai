export interface Source {
  id: string;
  name: string;
  type: "rss" | "reddit" | "hn" | "github" | "bluesky" | "api" | "scrape";
  url: string;
  category: "ai" | "dev" | "jobs";
}

export const CATEGORY_LIMITS: Record<Source["category"], number> = {
  ai: 10,
  dev: 15,
  jobs: 10,
};

// Staleness threshold in days — sources with no items beyond this are flagged
export const FRESHNESS_THRESHOLDS: Record<Source["category"], number> = {
  ai: 1, // AI news: stale after 24h
  dev: 7, // Dev/industry: stale after 7 days
  jobs: 7, // Jobs: stale after 7 days
};

export const sources: Source[] = [
  // === AI (8 sources) ===
  {
    id: "anthropic-news",
    name: "Anthropic News",
    type: "rss",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    category: "ai",
  },
  {
    id: "openai-news",
    name: "OpenAI News",
    type: "rss",
    url: "https://openai.com/news/rss.xml",
    category: "ai",
  },
  {
    id: "simon-willison",
    name: "Simon Willison",
    type: "rss",
    url: "https://simonwillison.net/atom/everything/",
    category: "ai",
  },
  {
    id: "latent-space",
    name: "Latent Space",
    type: "rss",
    url: "https://www.latent.space/feed",
    category: "ai",
  },
  {
    id: "huggingface-blog",
    name: "Hugging Face Blog",
    type: "rss",
    url: "https://huggingface.co/blog/feed.xml",
    category: "ai",
  },
  {
    id: "every-to",
    name: "Every.to",
    type: "scrape",
    url: "https://every.to/newsletter",
    category: "ai",
  },
  {
    id: "hn-ai",
    name: "Hacker News AI",
    type: "hn",
    url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+Claude+OR+GPT&points=100",
    category: "ai",
  },
  {
    id: "r-localllama",
    name: "r/LocalLLaMA",
    type: "reddit",
    url: "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day",
    category: "ai",
  },

  // === Dev — Vue/Vite Ecosystem (10 sources) ===
  {
    id: "vue-blog",
    name: "Vue.js Blog",
    type: "rss",
    url: "https://blog.vuejs.org/feed.rss",
    category: "dev",
  },
  {
    id: "evan-you-bluesky",
    name: "Evan You",
    type: "bluesky",
    url: "evanyou.me",
    category: "dev",
  },
  {
    id: "anthony-fu-bluesky",
    name: "Anthony Fu",
    type: "bluesky",
    url: "antfu.me",
    category: "dev",
  },
  {
    id: "r-vuejs",
    name: "r/vuejs",
    type: "reddit",
    url: "https://www.reddit.com/r/vuejs/top/.rss?t=day",
    category: "dev",
  },
  {
    id: "hn-vue",
    name: "Hacker News Vue/Vite",
    type: "hn",
    url: "https://hnrss.org/newest?q=Vue+OR+Vite+OR+Nuxt&points=50",
    category: "dev",
  },
  {
    id: "gh-vue",
    name: "Vue Releases",
    type: "github",
    url: "https://github.com/vuejs/core/releases.atom",
    category: "dev",
  },
  {
    id: "gh-vite",
    name: "Vite Releases",
    type: "github",
    url: "https://github.com/vitejs/vite/releases.atom",
    category: "dev",
  },
  {
    id: "gh-vueuse",
    name: "VueUse Releases",
    type: "github",
    url: "https://github.com/vueuse/vueuse/releases.atom",
    category: "dev",
  },
  {
    id: "gh-nuxt",
    name: "Nuxt Releases",
    type: "github",
    url: "https://github.com/nuxt/nuxt/releases.atom",
    category: "dev",
  },
  {
    id: "gh-vitest",
    name: "Vitest Releases",
    type: "github",
    url: "https://github.com/vitest-dev/vitest/releases.atom",
    category: "dev",
  },

  // === Dev — Laravel (4 sources) ===
  {
    id: "laravel-news",
    name: "Laravel News",
    type: "rss",
    url: "https://feed.laravel-news.com",
    category: "dev",
  },
  {
    id: "taylor-otwell-bluesky",
    name: "Taylor Otwell",
    type: "bluesky",
    url: "taylorotwell.com",
    category: "dev",
  },
  {
    id: "gh-laravel",
    name: "Laravel Releases",
    type: "github",
    url: "https://github.com/laravel/framework/releases.atom",
    category: "dev",
  },
  {
    id: "r-laravel",
    name: "r/laravel",
    type: "reddit",
    url: "https://www.reddit.com/r/laravel/top/.rss?t=day",
    category: "dev",
  },

  // === Dev — Frontend/Web Platform (6 sources) ===
  {
    id: "nerdy-dev",
    name: "nerdy.dev / Adam Argyle",
    type: "rss",
    url: "https://nerdy.dev/rss.xml",
    category: "dev",
  },
  {
    id: "web-dev",
    name: "web.dev",
    type: "rss",
    url: "https://web.dev/feed.xml",
    category: "dev",
  },
  {
    id: "chrome-developers",
    name: "Chrome Developers",
    type: "rss",
    url: "https://developer.chrome.com/blog/feed.xml",
    category: "dev",
  },
  {
    id: "js-weekly",
    name: "JavaScript Weekly",
    type: "rss",
    url: "https://javascriptweekly.com/rss",
    category: "dev",
  },
  {
    id: "hn-frontend",
    name: "Hacker News Frontend",
    type: "hn",
    url: "https://hnrss.org/newest?q=CSS+OR+JavaScript+OR+TypeScript&points=75",
    category: "dev",
  },
  {
    id: "cloudflare-blog",
    name: "Cloudflare Blog",
    type: "rss",
    url: "https://blog.cloudflare.com/rss/",
    category: "dev",
  },

  // === Dev — YouTube (2 sources) ===
  {
    id: "yt-aaron-francis",
    name: "Aaron Francis",
    type: "rss",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXBhQ05nu8Pxn4Ey093Upwg",
    category: "dev",
  },
  {
    id: "yt-fireship",
    name: "Fireship",
    type: "rss",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA",
    category: "dev",
  },

  // === Jobs (5 sources) ===
  {
    id: "vuejobs",
    name: "VueJobs",
    type: "rss",
    url: "https://vuejobs.com/feed",
    category: "jobs",
  },
  {
    id: "hn-hiring",
    name: "HN Who's Hiring",
    type: "hn",
    url: "https://hn.algolia.com/api/v1/search?query=%22Ask%20HN%3A%20Who%20is%20hiring%22&tags=ask_hn&hitsPerPage=1",
    category: "jobs",
  },
  {
    id: "remotive-dev",
    name: "Remotive Software Dev",
    type: "rss",
    url: "https://remotive.com/remote-jobs/feed/software-development",
    category: "jobs",
  },
  {
    id: "wwr-frontend",
    name: "We Work Remotely Frontend",
    type: "rss",
    url: "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
    category: "jobs",
  },
  {
    id: "jobicy-vue-uk",
    name: "Jobicy Vue UK/Remote",
    type: "api",
    url: "https://jobicy.com/api/v2/remote-jobs?tag=vue&geo=uk",
    category: "jobs",
  },
];
