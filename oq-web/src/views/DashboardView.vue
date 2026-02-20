<script setup lang="ts">
import { onMounted, ref } from "vue";
import { motion } from "motion-v";
import type {
  OQModelScore,
  OQModelAgreement,
  OQHistoryEntry,
} from "@feed-ai/shared/oq-types";
import { formatModelName } from "../utils/format";

interface DashboardScore {
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  analysis: string;
  capabilityGap?: string;
  modelScores: OQModelScore[];
  modelAgreement: OQModelAgreement;
  modelSpread: number;
}

const loading = ref(false);
const error = ref<string | null>(null);
const needsAuth = ref(false);
const adminKey = ref("");
const keyInput = ref("");

const todayScore = ref<DashboardScore | null>(null);
const history = ref<OQHistoryEntry[]>([]);

const fetching = ref(false);
const fetchResult = ref("");
const scoring = ref(false);
const scoreResult = ref("");

async function loadDashboard() {
  loading.value = true;
  error.value = null;
  try {
    const [todayRes, historyRes] = await Promise.all([
      fetch("/api/today"),
      fetch("/api/history?d=14"),
    ]);
    if (todayRes.ok) todayScore.value = await todayRes.json();
    if (historyRes.ok) history.value = await historyRes.json();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load";
  } finally {
    loading.value = false;
  }
}

function submitKey() {
  const trimmed = keyInput.value.trim();
  if (!trimmed) return;
  adminKey.value = trimmed;
  needsAuth.value = false;
  keyInput.value = "";
  loadDashboard();
}

async function fetchArticles() {
  fetching.value = true;
  fetchResult.value = "";
  try {
    const res = await fetch("/api/fetch", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminKey.value}` },
    });
    const data = await res.json();
    fetchResult.value = res.ok
      ? JSON.stringify(data)
      : `Error: ${JSON.stringify(data)}`;
    if (res.status === 401) needsAuth.value = true;
    await loadDashboard();
  } catch (e) {
    fetchResult.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    fetching.value = false;
  }
}

async function generateScore() {
  scoring.value = true;
  scoreResult.value = "";
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminKey.value}` },
    });
    const data = await res.json();
    scoreResult.value = res.ok
      ? JSON.stringify(data)
      : `Error: ${JSON.stringify(data)}`;
    if (res.status === 401) needsAuth.value = true;
    await loadDashboard();
  } catch (e) {
    scoreResult.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    scoring.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="h-[100dvh] overflow-y-auto bg-gray-950 p-4 text-gray-100">
    <div class="mx-auto max-w-4xl">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-white">OQ Dashboard</h1>
        <div class="flex items-center gap-3">
          <button
            v-if="!needsAuth && adminKey"
            :disabled="fetching"
            class="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-50"
            @click="fetchArticles"
          >
            {{ fetching ? "Fetching..." : "Fetch Articles" }}
          </button>
          <button
            v-if="!needsAuth && adminKey"
            :disabled="scoring"
            class="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400 hover:bg-orange-500/20 disabled:opacity-50"
            @click="generateScore"
          >
            {{ scoring ? "Scoring..." : "Generate Score" }}
          </button>
          <router-link to="/" class="text-xs text-gray-500 hover:text-white">
            Public View
          </router-link>
        </div>
      </div>

      <!-- Action results -->
      <div
        v-if="fetchResult"
        class="mb-4 rounded-lg border border-green-800 bg-green-950 px-4 py-2 text-sm text-green-300"
      >
        {{ fetchResult }}
      </div>
      <div
        v-if="scoreResult"
        class="mb-4 rounded-lg border border-green-800 bg-green-950 px-4 py-2 text-sm text-green-300"
      >
        {{ scoreResult }}
      </div>

      <!-- Auth prompt -->
      <div v-if="needsAuth" class="mx-auto max-w-sm py-20">
        <p class="mb-4 text-center text-sm text-gray-400">
          Enter admin key for write actions
        </p>
        <form class="flex gap-2" @submit.prevent="submitKey">
          <input
            v-model="keyInput"
            type="password"
            placeholder="Admin key"
            class="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            class="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            Go
          </button>
        </form>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="py-20 text-center text-sm text-red-400">
        {{ error }}
      </div>

      <!-- Dashboard content -->
      <template v-else-if="todayScore">
        <!-- Stats row -->
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            class="rounded-xl border border-orange-500/20 bg-gray-900 p-4 text-center"
          >
            <div class="font-mono text-2xl font-medium text-orange-400">
              {{ todayScore.score }}
            </div>
            <div class="mt-1 text-xs text-gray-500">Today's Score</div>
          </div>
          <div
            class="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center"
          >
            <div class="font-mono text-2xl font-medium text-white">
              {{ todayScore.scoreTechnical }}
            </div>
            <div class="mt-1 text-xs text-gray-500">Technical</div>
          </div>
          <div
            class="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center"
          >
            <div class="font-mono text-2xl font-medium text-white">
              {{ todayScore.scoreEconomic }}
            </div>
            <div class="mt-1 text-xs text-gray-500">Economic</div>
          </div>
          <div
            class="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center"
          >
            <div
              class="font-mono text-2xl font-medium"
              :class="{
                'text-red-400': todayScore.delta > 0,
                'text-emerald-400': todayScore.delta < 0,
                'text-gray-500': todayScore.delta === 0,
              }"
            >
              {{ todayScore.delta > 0 ? "+" : "" }}{{ todayScore.delta }}
            </div>
            <div class="mt-1 text-xs text-gray-500">Daily Delta</div>
          </div>
        </div>

        <!-- Analysis -->
        <motion.section
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.1 }"
        >
          <h2
            class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Today's Analysis
          </h2>
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p class="text-sm leading-relaxed text-gray-300">
              {{ todayScore.analysis }}
            </p>
            <div
              v-if="todayScore.capabilityGap"
              class="mt-3 border-t border-gray-800 pt-3 text-xs text-gray-500"
            >
              {{ todayScore.capabilityGap }}
            </div>
          </div>
        </motion.section>

        <!-- Model Scores -->
        <motion.section
          v-if="todayScore.modelScores.length > 0"
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.2 }"
        >
          <h2
            class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Model Breakdown
            <span class="ml-2 text-xs font-normal text-gray-600">
              {{ todayScore.modelAgreement }}
              · spread:
              {{ todayScore.modelSpread }}
            </span>
          </h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <div
              v-for="model in todayScore.modelScores"
              :key="model.model"
              class="rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-medium text-white">
                  {{ formatModelName(model.model) }}
                </span>
                <span class="font-mono text-sm text-orange-400">
                  {{ model.suggested_delta > 0 ? "+" : ""
                  }}{{ model.suggested_delta }}
                </span>
              </div>
              <p class="text-xs leading-relaxed text-gray-400">
                {{ model.analysis }}
              </p>
            </div>
          </div>
        </motion.section>

        <!-- Score History -->
        <motion.section
          v-if="history.length > 0"
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.3 }"
        >
          <h2
            class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Score History (14d)
          </h2>
          <div
            class="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900"
          >
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-gray-800 text-gray-500">
                  <th class="px-3 py-2 font-medium">Date</th>
                  <th class="px-3 py-2 font-medium">Score</th>
                  <th class="px-3 py-2 font-medium">Tech</th>
                  <th class="px-3 py-2 font-medium">Econ</th>
                  <th class="px-3 py-2 font-medium">Delta</th>
                  <th class="px-3 py-2 font-medium">Spread</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in history"
                  :key="entry.date"
                  class="border-b border-gray-800/50"
                >
                  <td class="px-3 py-2 text-gray-300">{{ entry.date }}</td>
                  <td class="px-3 py-2 font-mono font-medium text-white">
                    {{ entry.score }}
                  </td>
                  <td class="px-3 py-2 font-mono text-gray-400">
                    {{ entry.scoreTechnical }}
                  </td>
                  <td class="px-3 py-2 font-mono text-gray-400">
                    {{ entry.scoreEconomic }}
                  </td>
                  <td
                    class="px-3 py-2 font-mono"
                    :class="{
                      'text-red-400': entry.delta > 0,
                      'text-emerald-400': entry.delta < 0,
                      'text-gray-500': entry.delta === 0,
                    }"
                  >
                    {{ entry.delta > 0 ? "+" : "" }}{{ entry.delta }}
                  </td>
                  <td class="px-3 py-2 font-mono text-gray-500">
                    {{ entry.modelSpread }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.section>

        <!-- Refresh -->
        <div class="pb-8 text-center">
          <button
            class="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
            @click="loadDashboard"
          >
            Refresh
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
