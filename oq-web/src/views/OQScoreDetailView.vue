<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@unhead/vue";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@feed-ai/shared/components/ui/collapsible";
import { ChevronDown, ArrowLeft, ExternalLink } from "lucide-vue-next";
import OQSignalList from "../components/OQSignalList.vue";
import { formatModelName } from "@feed-ai/shared/utils";

interface ModelResponse {
  model: string;
  provider: string;
  pillarScores: Record<string, number>;
  technicalDelta: number;
  economicDelta: number;
  suggestedDelta: number;
  analysis: string;
  topSignals: {
    text: string;
    direction: string;
    source: string;
    impact: number;
    url?: string;
  }[];
  capabilityGapNote?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

interface Article {
  title: string;
  url: string;
  source: string;
  pillar: string;
  publishedAt: string;
}

interface ScoreDetail {
  date: string;
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  deltaExplanation?: string;
  analysis: string;
  signals: {
    text: string;
    direction: "up" | "down" | "neutral";
    source: string;
    impact: number;
    url?: string;
  }[];
  pillarScores: Record<string, number>;
  modelScores: { model: string; suggested_delta: number; analysis: string }[];
  modelAgreement: string;
  modelSpread: number;
  promptHash?: string;
  articles: Article[];
  modelResponses: ModelResponse[];
}

const route = useRoute();

const data = ref<ScoreDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const modelsOpen = ref(false);
const articlesOpen = ref(false);
const pillarsOpen = ref(false);

useHead({
  title: () =>
    data.value
      ? `Score: ${data.value.score}% — ${data.value.date} — One Question`
      : "Score Detail — One Question",
});

const formattedDate = computed(() => {
  if (!data.value) return "";
  const d = new Date(data.value.date + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
});

const deltaFormatted = computed(() => {
  if (!data.value) return "";
  const d = data.value.delta;
  if (d === 0) return "No change";
  return `${d > 0 ? "+" : ""}${d}`;
});

const pillarLabels: Record<string, string> = {
  capability: "AI Capability",
  labour_market: "Labour Market",
  sentiment: "Sentiment",
  industry: "Industry",
  barriers: "Barriers",
};

const articlesByPillar = computed(() => {
  if (!data.value) return {};
  const grouped: Record<string, Article[]> = {};
  for (const a of data.value.articles) {
    if (!grouped[a.pillar]) grouped[a.pillar] = [];
    grouped[a.pillar].push(a);
  }
  return grouped;
});

onMounted(async () => {
  const date = Array.isArray(route.params.date)
    ? route.params.date[0]
    : route.params.date;
  try {
    const res = await fetch(`/api/score/${date}`);
    if (!res.ok) {
      error.value =
        res.status === 404
          ? "No score found for this date."
          : "Failed to load score.";
      return;
    }
    data.value = await res.json();
  } catch {
    error.value = "Failed to load score.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="h-[100dvh] overflow-y-auto bg-background text-foreground">
    <div class="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <!-- Back link -->
      <router-link
        to="/"
        class="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft class="h-3 w-3" />
        Back to today
      </router-link>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-orange-500"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="py-20 text-center text-sm text-destructive">
        {{ error }}
      </div>

      <!-- Content -->
      <template v-else-if="data">
        <Card class="border-border bg-card py-0">
          <CardContent class="p-6 sm:p-8">
            <!-- Header -->
            <div class="mb-6 flex items-start justify-between">
              <div>
                <div
                  class="text-xs tracking-widest text-muted-foreground uppercase"
                >
                  {{ formattedDate }}
                </div>
                <div
                  class="mt-2 font-mono text-4xl font-medium text-orange-500"
                >
                  {{ data.score
                  }}<span class="text-lg text-muted-foreground">%</span>
                </div>
                <div class="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span>Technical: {{ data.scoreTechnical }}%</span>
                  <span>Economic: {{ data.scoreEconomic }}%</span>
                </div>
              </div>
              <Badge
                :variant="
                  data.delta > 0
                    ? 'error'
                    : data.delta < 0
                      ? 'success'
                      : 'secondary'
                "
                class="font-mono text-xs"
              >
                <span v-if="data.delta > 0">▲</span>
                <span v-else-if="data.delta < 0">▼</span>
                <span v-else>●</span>
                {{ deltaFormatted }}
              </Badge>
            </div>

            <!-- Delta explanation -->
            <p
              v-if="data.deltaExplanation"
              class="mb-4 text-sm leading-relaxed text-muted-foreground"
            >
              {{ data.deltaExplanation }}
            </p>

            <!-- Analysis -->
            <div class="mb-6">
              <div
                class="mb-2 text-[10px] tracking-widest text-muted-foreground uppercase"
              >
                AI Analysis
              </div>
              <p
                class="text-[15px] leading-[1.7] font-light text-muted-foreground"
              >
                {{ data.analysis }}
              </p>
            </div>

            <!-- Signals -->
            <OQSignalList
              v-if="data.signals.length > 0"
              :signals="data.signals"
            />
          </CardContent>
        </Card>

        <!-- ═══ MODEL BREAKDOWN (collapsible) ═══ -->
        <Collapsible
          v-if="data.modelResponses.length > 0"
          v-model:open="modelsOpen"
          class="mt-6"
        >
          <Card class="border-border bg-card py-0">
            <CollapsibleTrigger class="w-full cursor-pointer">
              <CardContent class="flex items-center justify-between p-4">
                <span
                  class="text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  Model Breakdown
                </span>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground transition-transform duration-200"
                  :class="{ 'rotate-180': modelsOpen }"
                />
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="space-y-4 border-t border-border p-4 sm:p-6">
                <div
                  v-for="mr in data.modelResponses"
                  :key="mr.model"
                  class="rounded-xl border border-border bg-secondary/30 p-4"
                >
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-sm font-medium text-foreground">
                      {{ formatModelName(mr.model) }}
                    </span>
                    <Badge
                      :variant="
                        mr.suggestedDelta > 0
                          ? 'error'
                          : mr.suggestedDelta < 0
                            ? 'success'
                            : 'secondary'
                      "
                      class="font-mono text-[10px]"
                    >
                      {{ mr.suggestedDelta > 0 ? "+" : ""
                      }}{{ mr.suggestedDelta.toFixed(1) }}
                    </Badge>
                  </div>
                  <p class="text-xs leading-relaxed text-muted-foreground">
                    {{ mr.analysis }}
                  </p>
                  <div
                    class="mt-2 flex gap-3 font-mono text-[10px] text-muted-foreground/60"
                  >
                    <span
                      >Tech: {{ mr.technicalDelta > 0 ? "+" : ""
                      }}{{ mr.technicalDelta }}</span
                    >
                    <span
                      >Econ: {{ mr.economicDelta > 0 ? "+" : ""
                      }}{{ mr.economicDelta }}</span
                    >
                    <span v-if="mr.latencyMs"
                      >{{ (mr.latencyMs / 1000).toFixed(1) }}s</span
                    >
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <!-- ═══ ARTICLES FED TO MODELS (collapsible) ═══ -->
        <Collapsible
          v-if="data.articles.length > 0"
          v-model:open="articlesOpen"
          class="mt-4"
        >
          <Card class="border-border bg-card py-0">
            <CollapsibleTrigger class="w-full cursor-pointer">
              <CardContent class="flex items-center justify-between p-4">
                <span
                  class="text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  Articles Fed to Models ({{ data.articles.length }})
                </span>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground transition-transform duration-200"
                  :class="{ 'rotate-180': articlesOpen }"
                />
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="space-y-4 border-t border-border p-4 sm:p-6">
                <div
                  v-for="(articles, pillar) in articlesByPillar"
                  :key="pillar"
                >
                  <div
                    class="mb-2 text-[10px] tracking-widest text-muted-foreground uppercase"
                  >
                    {{ pillarLabels[pillar] ?? pillar }}
                  </div>
                  <div class="space-y-1">
                    <a
                      v-for="article in articles"
                      :key="article.url"
                      :href="article.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-start gap-2 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink
                        class="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/30"
                      />
                      <span class="flex-1">{{ article.title }}</span>
                      <span
                        class="shrink-0 font-mono text-[10px] text-muted-foreground/40"
                      >
                        {{ article.source }}
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <!-- ═══ PILLAR SCORES (collapsible) ═══ -->
        <Collapsible
          v-if="data.pillarScores && Object.keys(data.pillarScores).length"
          v-model:open="pillarsOpen"
          class="mt-4"
        >
          <Card class="border-border bg-card py-0">
            <CollapsibleTrigger class="w-full cursor-pointer">
              <CardContent class="flex items-center justify-between p-4">
                <span
                  class="text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  Pillar Scores
                </span>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground transition-transform duration-200"
                  :class="{ 'rotate-180': pillarsOpen }"
                />
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="space-y-3 border-t border-border p-4 sm:p-6">
                <div
                  v-for="(score, pillar) in data.pillarScores"
                  :key="pillar"
                  class="flex items-center justify-between"
                >
                  <span class="text-xs text-muted-foreground">
                    {{ pillarLabels[pillar] ?? pillar }}
                  </span>
                  <Badge
                    :variant="
                      score > 0 ? 'error' : score < 0 ? 'success' : 'secondary'
                    "
                    class="font-mono text-[10px]"
                  >
                    {{ score > 0 ? "+" : "" }}{{ score }}
                  </Badge>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <!-- Prompt hash -->
        <div
          v-if="data.promptHash"
          class="mt-6 text-center text-[10px] text-muted-foreground/40"
        >
          Generated with prompt version
          <code class="rounded bg-secondary/50 px-1.5 py-0.5 font-mono">
            {{ data.promptHash }}
          </code>
          ·
          <router-link to="/methodology" class="hover:text-orange-500/60">
            Methodology
          </router-link>
        </div>

        <div class="pb-16" />
      </template>
    </div>
  </div>
</template>
