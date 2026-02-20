<script setup lang="ts">
import { onMounted } from "vue";
import { motion } from "motion-v";
import { useOneQuestion } from "../composables/useOneQuestion";
import OQScoreGauge from "../components/OQScoreGauge.vue";
import OQSignalList from "../components/OQSignalList.vue";
import OQTrendChart from "../components/OQTrendChart.vue";
import OQModelAgreement from "../components/OQModelAgreement.vue";
import OQSubscribe from "../components/OQSubscribe.vue";

const {
  today,
  history,
  loading,
  error,
  formattedDate,
  deltaFormatted,
  deltaDirection,
  fetchToday,
  fetchHistory,
  subscribe,
  subscribeStatus,
} = useOneQuestion();

onMounted(async () => {
  await Promise.all([fetchToday(), fetchHistory()]);
});
</script>

<template>
  <div class="min-h-[100dvh] overflow-y-auto bg-gray-950 text-gray-100">
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
          class="font-serif text-lg tracking-tight text-gray-500"
        >
          one<span class="text-orange-500">?</span>
        </router-link>
        <span
          class="rounded-full border border-orange-500/15 bg-orange-500/8 px-3 py-1 text-[11px] font-medium tracking-widest text-orange-500 uppercase"
        >
          Live — Updated Daily
        </span>
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
          class="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-gray-500"
        >
          AI tracks the signals daily. Reads the research, watches the market,
          and gives its honest assessment.
        </p>
      </motion.section>

      <!-- Loading -->
      <div v-if="loading && !today" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-orange-500"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="py-20 text-center text-sm text-red-400">
        {{ error }}
      </div>

      <!-- Content -->
      <template v-else-if="today">
        <!-- Score Card -->
        <motion.section
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.2 }"
        >
          <div
            class="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-10"
          >
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

            <!-- Header -->
            <div
              class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <div class="text-xs tracking-widest text-gray-600 uppercase">
                  {{ formattedDate }}
                </div>
                <div class="mt-1 text-sm text-gray-500">
                  Replacement Likelihood Score
                </div>
              </div>
              <div
                class="flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 font-mono text-xs"
                :class="{
                  'bg-red-500/8 text-red-400': deltaDirection === 'up',
                  'bg-emerald-500/8 text-emerald-400':
                    deltaDirection === 'down',
                  'bg-gray-800 text-gray-500': deltaDirection === 'neutral',
                }"
              >
                <span v-if="deltaDirection === 'up'">▲</span>
                <span v-else-if="deltaDirection === 'down'">▼</span>
                <span v-else>●</span>
                {{ deltaFormatted }}
              </div>
            </div>

            <!-- Gauge -->
            <OQScoreGauge
              :score="today.score"
              :score-technical="today.scoreTechnical"
              :score-economic="today.scoreEconomic"
            />

            <!-- Analysis -->
            <div class="mt-6 border-t border-gray-800 pt-6 sm:mt-8 sm:pt-8">
              <div
                class="mb-3 flex items-center gap-2 text-[10px] tracking-widest text-gray-600 uppercase"
              >
                <span
                  class="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
                />
                Today's AI Take
              </div>
              <p class="text-[15px] leading-[1.7] font-light text-gray-400">
                {{ today.analysis }}
              </p>
            </div>

            <!-- Model Agreement -->
            <OQModelAgreement
              v-if="today.modelScores.length > 1"
              :model-agreement="today.modelAgreement"
              :model-spread="today.modelSpread"
              :model-scores="today.modelScores"
              class="mt-6"
            />

            <!-- Signals -->
            <OQSignalList
              v-if="today.signals.length > 0"
              :signals="today.signals"
              class="mt-6"
            />
          </div>
        </motion.section>

        <!-- Capability Gap -->
        <motion.section
          v-if="today.capabilityGap"
          class="mt-6"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.3 }"
        >
          <div
            class="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
          >
            <div
              class="mb-3 text-[10px] tracking-widest text-gray-600 uppercase"
            >
              The Capability Gap
            </div>
            <p class="text-sm leading-relaxed text-gray-400">
              {{ today.capabilityGap }}
            </p>
          </div>
        </motion.section>

        <!-- Trend Chart -->
        <motion.section
          v-if="history.length > 1"
          class="mt-8"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.4 }"
        >
          <div class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
            Score over time
          </div>
          <OQTrendChart :history="history" />
        </motion.section>

        <!-- Subscribe -->
        <motion.section
          class="pt-12 pb-16"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.6, delay: 0.5 }"
        >
          <OQSubscribe :status="subscribeStatus" @subscribe="subscribe" />
        </motion.section>
      </template>

      <!-- Footer -->
      <footer
        class="border-t border-gray-800 py-6 text-center text-xs text-gray-600"
      >
        Built by
        <a
          href="https://andresjanes.com"
          class="text-gray-500 hover:text-orange-500"
          target="_blank"
          rel="noopener"
        >
          Andres Janes
        </a>
        · Powered by feed-ai · Data refreshed daily at 06:30 UTC
      </footer>
    </div>
  </div>
</template>
