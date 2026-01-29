export interface Source {
  id: string;
  name: string;
  type: 'rss' | 'reddit' | 'hn' | 'github';
  url: string;
  category: 'ai' | 'jobs' | 'dev' | 'competitors';
}

export const sources: Source[] = [
  // AI News
  {
    id: 'anthropic-blog',
    name: 'Anthropic Blog',
    type: 'rss',
    url: 'https://www.anthropic.com/rss.xml',
    category: 'ai'
  },
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    type: 'rss',
    url: 'https://openai.com/blog/rss.xml',
    category: 'ai'
  },
  {
    id: 'hn-ai',
    name: 'Hacker News AI',
    type: 'rss',
    url: 'https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT&points=50',
    category: 'ai'
  },
  {
    id: 'r-machinelearning',
    name: 'r/MachineLearning',
    type: 'reddit',
    url: 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day',
    category: 'ai'
  },
  {
    id: 'r-localllama',
    name: 'r/LocalLLaMA',
    type: 'reddit',
    url: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day',
    category: 'ai'
  },

  // Vue/Dev
  {
    id: 'r-vuejs',
    name: 'r/vuejs',
    type: 'reddit',
    url: 'https://www.reddit.com/r/vuejs/top/.rss?t=week',
    category: 'dev'
  },

  // Jobs
  {
    id: 'vuejobs',
    name: 'VueJobs',
    type: 'rss',
    url: 'https://vuejobs.com/feed',
    category: 'jobs'
  },
  {
    id: 'remoteok-dev',
    name: 'RemoteOK Dev',
    type: 'rss',
    url: 'https://remoteok.com/remote-dev-jobs.rss',
    category: 'jobs'
  },
];
