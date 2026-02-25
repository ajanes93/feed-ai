<script setup lang="ts">
import { onMounted } from "vue";
import { useHead } from "@unhead/vue";
import { motion } from "motion-v";
import { useOneQuestion } from "../composables/useOneQuestion";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import { Separator } from "@feed-ai/shared/components/ui/separator";
import OQScoreGauge from "../components/OQScoreGauge.vue";
import OQSignalList from "../components/OQSignalList.vue";
import OQTrendChart from "../components/OQTrendChart.vue";
import OQModelAgreement from "../components/OQModelAgreement.vue";
import OQSubscribe from "../components/OQSubscribe.vue";
import OQWhatWouldChange from "../components/OQWhatWouldChange.vue";
import OQCapabilityGap from "../components/OQCapabilityGap.vue";
import OQSanityHarness from "../components/OQSanityHarness.vue";
import OQEconomicReality from "../components/OQEconomicReality.vue";

const {
  today,
  history,
  methodology,
  loading,
  error,
  formattedDate,
  deltaFormatted,
  deltaDirection,
  fetchToday,
  fetchHistory,
  fetchMethodology,
  subscribe,
  subscribeStatus,
} = useOneQuestion();

useHead({
  title: () =>
    today.value
      ? `Will AI Replace Engineers? ${today.value.score}% — One Question`
      : "Will AI Replace Software Engineers? — One Question",
});

onMounted(async () => {
  await Promise.all([fetchToday(), fetchHistory(), fetchMethodology()]);
});
</script>

<template>
  <div class="h-[100dvh] overflow-y-auto bg-background text-foreground">
    <!-- Ambient glow -->
    <div
      class="pointer-events-none fixed top-[-30%] left-1/2 z-0 h-[600px] w-[800px] -translate-x-1/2"
      style="
        background: radial-gradient(
          ellipse,
          rgba(240, 94, 35, 0.12) 0%,
          transparent 70%
        );
      "
    />

    <div class="relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
      <!-- Header -->
      <header class="flex items-center justify-between pt-8">
        <router-link
          to="/"
          class="font-serif text-lg tracking-tight text-muted-foreground"
        >
          one<span class="text-orange-500">?</span>
        </router-link>
        <Badge
          variant="outline"
          class="border-orange-500/15 bg-orange-500/8 text-[11px] font-medium tracking-widest text-orange-500 uppercase"
        >
          Live — Updated Daily
        </Badge>
      </header>

      <!-- Hero -->
      <motion.section
        class="py-16 text-center sm:py-20"
        :initial="{ opacity: 0, y: 20 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8 }"
      >
        <h1
          class="font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl"
        >
          Will AI <em class="text-orange-500 italic">replace</em> software
          engineers?
        </h1>
        <p
          class="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground"
        >
          AI tracks the signals daily. Reads the research, watches the market,
          and gives its honest assessment.
        </p>
      </motion.section>

      <!-- Loading -->
      <div v-if="loading && !today" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-orange-500"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="py-20 text-center text-sm text-destructive">
        {{ error }}
      </div>

      <!-- Content -->
      <template v-else-if="today">
        <!-- ═══ SCORE CARD ═══ -->
        <motion.section
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.2 }"
        >
          <Card class="relative overflow-hidden border-border bg-card py-0">
            <!-- Top accent line -->
            <div
              class="absolute top-0 right-0 left-0 h-px"
              style="
                background: linear-gradient(
                  90deg,
                  transparent,
                  rgb(240 94 35),
                  transparent
                );
                opacity: 0.4;
              "
            />

            <CardContent class="p-6 sm:p-10">
              <!-- Header -->
              <div
                class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div
                    class="text-xs tracking-widest text-muted-foreground uppercase"
                  >
                    {{ formattedDate }}
                  </div>
                  <div class="mt-1 text-sm text-muted-foreground">
                    Replacement Likelihood Score
                  </div>
                </div>
                <div
                  data-testid="delta-area"
                  class="flex flex-col items-start gap-1 sm:items-end"
                >
                  <Badge
                    :variant="
                      deltaDirection === 'up'
                        ? 'error'
                        : deltaDirection === 'down'
                          ? 'success'
                          : 'secondary'
                    "
                    class="font-mono text-xs"
                  >
                    <span v-if="deltaDirection === 'up'">▲</span>
                    <span v-else-if="deltaDirection === 'down'">▼</span>
                    <span v-else>●</span>
                    {{ deltaFormatted }}
                  </Badge>
                  <!-- Delta explanation -->
                  <p
                    v-if="today.deltaExplanation"
                    class="max-w-xs text-[11px] leading-snug text-muted-foreground"
                  >
                    {{ today.deltaExplanation }}
                  </p>
                </div>
              </div>

              <!-- Gauge -->
              <OQScoreGauge
                :score="today.score"
                :score-technical="today.scoreTechnical"
                :score-economic="today.scoreEconomic"
              />

              <!-- Model Agreement -->
              <OQModelAgreement
                v-if="today.modelScores.length > 1"
                :model-agreement="today.modelAgreement"
                :model-spread="today.modelSpread"
                :model-scores="today.modelScores"
                class="mt-6"
              />

              <!-- Analysis -->
              <Separator class="my-6 bg-border sm:my-8" />
              <div>
                <div
                  class="mb-3 flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  <span
                    class="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
                  />
                  Today's AI Take
                </div>
                <p
                  class="whitespace-pre-line text-[15px] leading-[1.7] font-light text-muted-foreground"
                >
                  {{ today.analysis }}
                </p>
              </div>

              <!-- Signals -->
              <OQSignalList
                v-if="today.signals.length > 0"
                :signals="today.signals"
                class="mt-6"
              />

              <!-- Full breakdown link -->
              <router-link
                :to="`/score/${today.date}`"
                class="mt-4 block text-center text-[11px] text-muted-foreground/50 transition-colors hover:text-orange-500/60"
              >
                Full breakdown: model reasoning, articles, pillar scores →
              </router-link>
            </CardContent>
          </Card>
        </motion.section>

        <!-- ═══ TREND CHART ═══ -->
        <motion.section
          v-if="history.length > 1"
          class="mt-6"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.3 }"
        >
          <div
            class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
          >
            Score over time
          </div>
          <OQTrendChart :history="history" />
        </motion.section>

        <!-- ═══ CAPABILITY GAP (Technical evidence) ═══ -->
        <motion.section
          class="mt-10"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.35 }"
        >
          <div class="mb-3 flex items-baseline gap-3">
            <span
              class="text-[10px] tracking-widest text-muted-foreground uppercase"
              >Can AI actually do the job?</span
            >
            <Badge
              variant="outline"
              class="border-border text-[9px] font-mono text-muted-foreground"
            >
              Technical: {{ today.scoreTechnical }}%
            </Badge>
          </div>
          <OQCapabilityGap
            :verified="methodology?.capabilityGap?.verified ?? '~77%'"
            :pro="methodology?.capabilityGap?.pro ?? '~46%'"
            :verified-source="methodology?.capabilityGap?.verifiedSource"
            :pro-source="methodology?.capabilityGap?.proSource"
            :pro-private="methodology?.capabilityGap?.proPrivate"
            :pro-private-source="methodology?.capabilityGap?.proPrivateSource"
            :note="today.capabilityGap"
            :last-updated="methodology?.lastUpdated?.sweBench"
            :verified-delta="methodology?.deltas?.sweBench?.verifiedDelta"
            :pro-delta="methodology?.deltas?.sweBench?.proDelta"
            :pro-private-delta="methodology?.deltas?.sweBench?.proPrivateDelta"
            :previous-date="methodology?.deltas?.sweBench?.previousDate"
          />
        </motion.section>

        <!-- ═══ SANITY HARNESS (Agent Reality Check) ═══ -->
        <motion.section
          v-if="methodology?.sanityHarness"
          class="mt-8"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.4 }"
        >
          <div class="mb-3">
            <span
              class="text-[10px] tracking-widest text-muted-foreground uppercase"
              >How reliable are AI agents?</span
            >
          </div>
          <OQSanityHarness
            :top-pass-rate="methodology.sanityHarness.topPassRate"
            :top-agent="methodology.sanityHarness.topAgent"
            :top-model="methodology.sanityHarness.topModel"
            :median-pass-rate="methodology.sanityHarness.medianPassRate"
            :language-breakdown="methodology.sanityHarness.languageBreakdown"
            :note="today.sanityHarnessNote"
            :last-updated="methodology?.lastUpdated?.sanityHarness"
            :top-pass-rate-delta="
              methodology?.deltas?.sanityHarness?.topPassRateDelta
            "
            :median-pass-rate-delta="
              methodology?.deltas?.sanityHarness?.medianPassRateDelta
            "
            :previous-date="methodology?.deltas?.sanityHarness?.previousDate"
          />
        </motion.section>

        <!-- ═══ ECONOMIC REALITY ═══ -->
        <motion.section
          class="mt-8"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.45 }"
        >
          <div class="mb-3 flex items-baseline gap-3">
            <span
              class="text-[10px] tracking-widest text-muted-foreground uppercase"
              >Will companies actually do it?</span
            >
            <Badge
              variant="outline"
              class="border-border text-[9px] font-mono text-muted-foreground"
            >
              Economic: {{ today.scoreEconomic }}%
            </Badge>
          </div>
          <OQEconomicReality
            :software-index="methodology?.fredData?.softwareIndex"
            :software-date="methodology?.fredData?.softwareDate"
            :software-trend="methodology?.fredData?.softwareTrend"
            :software-index-delta="
              methodology?.deltas?.fred?.softwareIndexDelta
            "
            :general-index="methodology?.fredData?.generalIndex"
            :general-trend="methodology?.fredData?.generalTrend"
            :note="today.economicNote"
            :labour-note="today.labourNote"
            :total-raised="methodology?.fundingSummary?.totalRaised"
            :funding-count="methodology?.fundingSummary?.count"
            :top-round="methodology?.fundingSummary?.topRound"
            :funding-events="today.fundingEvents"
          />
        </motion.section>

        <!-- ═══ WHAT WOULD MOVE THIS SCORE ═══ -->
        <motion.section
          v-if="methodology"
          class="mt-8"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.5 }"
        >
          <div class="mb-3">
            <span
              class="text-[10px] tracking-widest text-muted-foreground uppercase"
              >What should you watch for?</span
            >
          </div>
          <OQWhatWouldChange
            :to50="methodology.whatWouldChange.to50"
            :to70="methodology.whatWouldChange.to70"
            :below20="methodology.whatWouldChange.below20"
          />
        </motion.section>

        <!-- ═══ SUBSCRIBE ═══ -->
        <motion.section
          class="pt-12 pb-16"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.55 }"
        >
          <OQSubscribe :status="subscribeStatus" @subscribe="subscribe" />
        </motion.section>
      </template>

      <!-- Footer -->
      <footer
        class="border-t border-border py-6 text-center text-xs text-muted-foreground"
      >
        Built by
        <a
          href="https://andresjanes.com"
          class="text-muted-foreground hover:text-orange-500"
          target="_blank"
          rel="noopener"
        >
          Andres Janes
        </a>
        ·
        <router-link
          to="/methodology"
          class="text-muted-foreground hover:text-orange-500"
        >
          Methodology
        </router-link>
        · Data refreshed daily at 06:30 UTC
      </footer>
    </div>
  </div>
</template>
