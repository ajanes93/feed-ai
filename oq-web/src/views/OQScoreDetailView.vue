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
import OQExplainer from "../components/OQExplainer.vue";
import OQFundingList from "../components/OQFundingList.vue";
import type { OQFundingEvent } from "@feed-ai/shared/oq-types";
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

interface ExternalDataSnapshot {
  sanityHarness?: {
    topPassRate: number;
    topAgent: string;
    topModel: string;
    medianPassRate: number;
    languageBreakdown: string;
  };
  sweBench?: {
    topVerified: number;
    topVerifiedModel: string;
    topBashOnly: number;
    topBashOnlyModel: string;
    topPro?: number;
    topProModel?: string;
    topProPrivate?: number;
    topProPrivateModel?: string;
  };
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: { change1w?: number; change4w?: number };
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: { change1w?: number; change4w?: number };
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
  capabilityGap?: string;
  sanityHarnessNote?: string;
  economicNote?: string;
  labourNote?: string;
  externalData?: ExternalDataSnapshot;
  fundingEvents?: OQFundingEvent[];
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
const dataOpen = ref(false);

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
  if (!data.value) return {} as Record<string, Article[]>;
  return data.value.articles.reduce<Record<string, Article[]>>((acc, a) => {
    (acc[a.pillar] ??= []).push(a);
    return acc;
  }, {});
});

onMounted(async () => {
  const date = [route.params.date].flat()[0];
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
                class="whitespace-pre-line text-[15px] leading-[1.7] font-light text-muted-foreground"
              >
                {{ data.analysis }}
              </p>
            </div>

            <!-- Signals -->
            <OQSignalList
              v-if="data.signals.length > 0"
              :signals="data.signals"
            />

            <!-- Capability Gap -->
            <div
              v-if="data.capabilityGap"
              class="mt-6 rounded-lg bg-secondary/30 px-4 py-3"
            >
              <div
                class="mb-1 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
              >
                Capability Gap
              </div>
              <p class="text-xs leading-relaxed text-muted-foreground">
                {{ data.capabilityGap }}
              </p>
            </div>

            <!-- AI-generated notes -->
            <div
              v-if="
                data.economicNote || data.labourNote || data.sanityHarnessNote
              "
              class="mt-4 space-y-2"
            >
              <p
                v-if="data.sanityHarnessNote"
                class="rounded-lg bg-orange-500/5 px-3 py-2 text-xs leading-relaxed text-orange-400/80"
              >
                {{ data.sanityHarnessNote }}
              </p>
              <p
                v-if="data.economicNote"
                class="rounded-lg bg-orange-500/5 px-3 py-2 text-xs leading-relaxed text-orange-400/80"
              >
                {{ data.economicNote }}
              </p>
              <p
                v-if="data.labourNote"
                class="rounded-lg bg-orange-500/5 px-3 py-2 text-xs leading-relaxed text-orange-400/80"
              >
                {{ data.labourNote }}
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- ═══ DATA SNAPSHOT (collapsible) ═══ -->
        <Collapsible
          v-if="
            data.externalData ||
            (data.fundingEvents && data.fundingEvents.length > 0)
          "
          v-model:open="dataOpen"
          class="mt-4"
        >
          <Card class="border-border bg-card py-0">
            <CollapsibleTrigger class="w-full cursor-pointer">
              <CardContent class="flex items-center justify-between p-4">
                <span
                  class="text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  Data Snapshot
                </span>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground transition-transform duration-200"
                  :class="{ 'rotate-180': dataOpen }"
                />
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="space-y-4 border-t border-border p-4 sm:p-6">
                <!-- FRED / Labour Market -->
                <div
                  v-if="
                    data.externalData?.softwareIndex !== undefined ||
                    data.externalData?.generalIndex !== undefined
                  "
                >
                  <div
                    class="mb-2 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
                  >
                    Labour Market (FRED)
                  </div>
                  <div class="space-y-1 text-xs text-muted-foreground">
                    <div
                      v-if="data.externalData?.softwareIndex !== undefined"
                      class="flex items-center gap-2"
                    >
                      <span>Indeed Software Index:</span>
                      <span class="font-mono text-foreground/80"
                        >~{{ data.externalData.softwareIndex }}</span
                      >
                      <span
                        v-if="
                          data.externalData.softwareTrend?.change4w !==
                          undefined
                        "
                        class="font-mono text-[10px]"
                        :class="
                          (data.externalData.softwareTrend?.change4w ?? 0) < 0
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        "
                      >
                        {{
                          (data.externalData.softwareTrend?.change4w ?? 0) > 0
                            ? "+"
                            : ""
                        }}{{ data.externalData.softwareTrend?.change4w }}% 4wk
                      </span>
                    </div>
                    <div
                      v-if="data.externalData?.generalIndex !== undefined"
                      class="flex items-center gap-2"
                    >
                      <span>Initial Claims:</span>
                      <span class="font-mono text-foreground/80">{{
                        data.externalData.generalIndex.toLocaleString()
                      }}</span>
                      <span
                        v-if="
                          data.externalData.generalTrend?.change4w !== undefined
                        "
                        class="font-mono text-[10px]"
                        :class="
                          (data.externalData.generalTrend?.change4w ?? 0) < 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        "
                      >
                        {{
                          (data.externalData.generalTrend?.change4w ?? 0) > 0
                            ? "+"
                            : ""
                        }}{{ data.externalData.generalTrend?.change4w }}% 4wk
                      </span>
                    </div>
                  </div>
                </div>

                <!-- SWE-bench -->
                <div
                  v-if="data.externalData?.sweBench"
                  class="border-t border-border pt-3"
                >
                  <div
                    class="mb-2 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
                  >
                    SWE-bench
                  </div>
                  <div
                    class="grid grid-cols-2 gap-2 text-xs text-muted-foreground"
                  >
                    <div>
                      Verified:
                      <span class="font-mono text-foreground/80"
                        >{{ data.externalData.sweBench.topVerified }}%</span
                      >
                      <span class="text-[10px] text-muted-foreground/50">
                        ({{
                          data.externalData.sweBench.topVerifiedModel
                        }})</span
                      >
                    </div>
                    <div>
                      Bash Only:
                      <span class="font-mono text-foreground/80"
                        >{{ data.externalData.sweBench.topBashOnly }}%</span
                      >
                      <span class="text-[10px] text-muted-foreground/50">
                        ({{
                          data.externalData.sweBench.topBashOnlyModel
                        }})</span
                      >
                    </div>
                    <div v-if="data.externalData.sweBench.topPro">
                      Pro:
                      <span class="font-mono text-foreground/80"
                        >{{ data.externalData.sweBench.topPro }}%</span
                      >
                      <span class="text-[10px] text-muted-foreground/50">
                        ({{ data.externalData.sweBench.topProModel }})</span
                      >
                    </div>
                    <div v-if="data.externalData.sweBench.topProPrivate">
                      Pro Private:
                      <span class="font-mono text-foreground/80"
                        >{{ data.externalData.sweBench.topProPrivate }}%</span
                      >
                      <span class="text-[10px] text-muted-foreground/50">
                        ({{
                          data.externalData.sweBench.topProPrivateModel
                        }})</span
                      >
                    </div>
                  </div>
                </div>

                <!-- SanityHarness -->
                <div
                  v-if="data.externalData?.sanityHarness"
                  class="border-t border-border pt-3"
                >
                  <div
                    class="mb-2 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
                  >
                    SanityHarness
                  </div>
                  <div class="space-y-1 text-xs text-muted-foreground">
                    <div>
                      Top:
                      <span class="font-mono text-foreground/80"
                        >{{
                          data.externalData.sanityHarness.topPassRate
                        }}%</span
                      >
                      ({{ data.externalData.sanityHarness.topAgent }} +
                      {{ data.externalData.sanityHarness.topModel }})
                    </div>
                    <div>
                      Median:
                      <span class="font-mono text-foreground/80"
                        >{{
                          data.externalData.sanityHarness.medianPassRate
                        }}%</span
                      >
                    </div>
                    <div
                      v-if="data.externalData.sanityHarness.languageBreakdown"
                      class="text-[10px] text-muted-foreground/50"
                    >
                      {{ data.externalData.sanityHarness.languageBreakdown }}
                    </div>
                  </div>
                </div>

                <!-- Funding Events -->
                <div
                  v-if="data.fundingEvents && data.fundingEvents.length > 0"
                  class="border-t border-border pt-3"
                >
                  <div
                    class="mb-2 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
                  >
                    AI Funding ({{ data.fundingEvents.length }} event{{
                      data.fundingEvents.length !== 1 ? "s" : ""
                    }})
                  </div>
                  <OQFundingList :events="data.fundingEvents" />
                </div>

                <!-- CEPR Study -->
                <div class="border-t border-border pt-3">
                  <div
                    class="mb-1 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
                  >
                    CEPR / BIS / EIB Study (Feb 2026)
                  </div>
                  <p class="text-xs text-muted-foreground">
                    12,000+ European firms studied. Result: +4% productivity, 0
                    job losses, 5.9x training ROI. AI increased output without
                    reducing headcount.
                  </p>
                  <a
                    href="https://cepr.org/publications/dp19956"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:text-orange-500/60"
                  >
                    Source: CEPR
                    <ExternalLink class="h-2 w-2" />
                  </a>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

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
                        class="shrink-0 text-right font-mono text-[10px] text-muted-foreground/40"
                      >
                        {{ article.source
                        }}<span v-if="article.publishedAt" class="ml-1"
                          >·
                          {{
                            new Date(
                              article.publishedAt.includes("T")
                                ? article.publishedAt
                                : article.publishedAt + "T00:00:00"
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          }}</span
                        >
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

        <!-- Data Processing / Methodology -->
        <Card class="mt-4 border-border bg-card py-0">
          <CardContent class="p-4 sm:p-6">
            <div
              class="mb-3 text-[10px] tracking-widest text-muted-foreground uppercase"
            >
              How This Score Was Generated
            </div>
            <div
              class="space-y-2 text-[11px] leading-relaxed text-muted-foreground/70"
            >
              <p>
                Three AI models (Claude, GPT-4o, Gemini Flash) independently
                scored today's articles across 5 pillars. Scores are weighted
                (Claude 40%, GPT-4 30%, Gemini 30%), dampened, and capped at
                &plusmn;1.2/day.
              </p>
              <p>
                External data (FRED labour indices, SWE-bench, SanityHarness,
                CEPR study, funding events) is injected into the prompt so
                models see the full picture.
              </p>
              <p v-if="data.articles.length > 0">
                {{ data.articles.length }} article{{
                  data.articles.length !== 1 ? "s" : ""
                }}
                were fed to the models for this score.
              </p>
            </div>
            <div
              v-if="data.promptHash"
              class="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground/40"
            >
              Prompt version
              <router-link
                :to="`/methodology#prompt-${data.promptHash}`"
                class="rounded bg-secondary/50 px-1.5 py-0.5 font-mono transition-colors hover:text-orange-500/60"
              >
                {{ data.promptHash }}
              </router-link>
              <OQExplainer
                text="A fingerprint of the exact scoring instructions given to the AI models. If the methodology changes, this hash changes. Click the hash to see the full prompt audit trail."
              />
              ·
              <router-link to="/methodology" class="hover:text-orange-500/60">
                Full methodology
              </router-link>
            </div>
          </CardContent>
        </Card>

        <div class="pb-16" />
      </template>
    </div>
  </div>
</template>
