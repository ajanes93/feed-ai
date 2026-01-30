export interface Source {
  id: string;
  name: string;
  type: "rss" | "reddit" | "hn" | "github" | "bluesky" | "api";
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
  // === AI (5 sources) ===
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
    id: "hn-ai",
    name: "Hacker News AI",
    type: "hn",
    url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+Claude+OR+GPT&points=100",
    category: "ai",
  },
  {
    id: "r-machinelearning",
    name: "r/MachineLearning",
    type: "reddit",
    url: "https://www.reddit.com/r/MachineLearning/top/.rss?t=day",
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
    id: "evan-you-bluesky",
    name: "Evan You",
    type: "bluesky",
    url: "https://bsky.app/profile/evanyou.me/rss",
    category: "dev",
  },
  {
    id: "anthony-fu-bluesky",
    name: "Anthony Fu",
    type: "bluesky",
    url: "https://bsky.app/profile/antfu.me/rss",
    category: "dev",
  },
  {
    id: "vuejsfeed",
    name: "Vue.js Feed",
    type: "rss",
    url: "https://vuejsfeed.com/feed",
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
    id: "gh-pinia",
    name: "Pinia Releases",
    type: "github",
    url: "https://github.com/vuejs/pinia/releases.atom",
    category: "dev",
  },
  {
    id: "gh-vue-router",
    name: "Vue Router Releases",
    type: "github",
    url: "https://github.com/vuejs/router/releases.atom",
    category: "dev",
  },
  {
    id: "gh-vueuse",
    name: "VueUse Releases",
    type: "github",
    url: "https://github.com/vueuse/vueuse/releases.atom",
    category: "dev",
  },

  // === Dev — More GitHub Releases (4 sources) ===
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
  {
    id: "gh-oxc",
    name: "OXC Releases",
    type: "github",
    url: "https://github.com/oxc-project/oxc/releases.atom",
    category: "dev",
  },
  {
    id: "gh-rolldown",
    name: "Rolldown Releases",
    type: "github",
    url: "https://github.com/rolldown/rolldown/releases.atom",
    category: "dev",
  },

  // === Dev — Laravel (2 sources) ===
  {
    id: "laravel-news",
    name: "Laravel News",
    type: "rss",
    url: "https://feed.laravel-news.com",
    category: "dev",
  },
  {
    id: "r-laravel",
    name: "r/laravel",
    type: "reddit",
    url: "https://www.reddit.com/r/laravel/top/.rss?t=day",
    category: "dev",
  },

  // === Dev — Rails (1 source) ===
  {
    id: "ruby-weekly",
    name: "Ruby Weekly",
    type: "rss",
    url: "https://rubyweekly.com/rss",
    category: "dev",
  },

  // === Dev — Frontend General (4 sources) ===
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
    id: "hn-frontend",
    name: "Hacker News Frontend",
    type: "hn",
    url: "https://hnrss.org/newest?q=CSS+OR+JavaScript+OR+browser&points=75",
    category: "dev",
  },
  {
    id: "js-weekly",
    name: "JavaScript Weekly",
    type: "rss",
    url: "https://javascriptweekly.com/rss",
    category: "dev",
  },

  // === Jobs (4 sources) ===
  {
    id: "vuejobs",
    name: "VueJobs",
    type: "rss",
    url: "https://vuejobs.com/feed",
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
