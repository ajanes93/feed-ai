<script setup lang="ts">
import { onMounted, ref } from "vue";
import { motion } from "motion-v";
import { useDashboard } from "../composables/useDashboard";
import { timeAgo, formatTokens, formatModelName } from "@feed-ai/shared/utils";
import DataTable from "@feed-ai/shared/components/DataTable";
import StatCard from "@feed-ai/shared/components/StatCard";
import DropdownMenu from "@feed-ai/shared/components/DropdownMenu";
import LogViewer from "@feed-ai/shared/components/LogViewer";

const {
  data,
  loading,
  error,
  needsAuth,
  adminKey,
  fetching,
  fetchResult,
  fetchSuccess,
  scoring,
  scoreResult,
  scoreSuccess,
  scoreAlreadyExists,
  setAdminKey,
  clearAdminKey,
  fetchDashboard,
  fetchArticles,
  generateScore,
  rescoreScore,
} = useDashboard();

const keyInput = ref("");

function submitKey() {
  const trimmed = keyInput.value.trim();
  if (!trimmed) return;
  setAdminKey(trimmed);
  keyInput.value = "";
  fetchDashboard();
}

onMounted(fetchDashboard);
</script>

<template>
  <div class="h-[100dvh] overflow-y-auto bg-gray-950 p-4 text-gray-100">
    <div class="mx-auto max-w-4xl">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-white">OQ Dashboard</h1>
        <div class="flex items-center gap-2">
          <DropdownMenu
            v-if="data && !needsAuth"
            label="Actions"
            :disabled="fetching || scoring"
          >
            <template #default="{ close }">
              <button
                :disabled="fetching"
                class="flex w-full flex-col px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50"
                @click="
                  close();
                  fetchArticles();
                "
              >
                <span class="font-medium">{{
                  fetching ? "Fetching..." : "Fetch Articles"
                }}</span>
                <span class="text-xs text-gray-500"
                  >Pull latest from all RSS sources</span
                >
              </button>
              <button
                :disabled="scoring"
                class="flex w-full flex-col px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50"
                @click="
                  close();
                  generateScore();
                "
              >
                <span class="font-medium">{{
                  scoring ? "Scoring..." : "Generate Score"
                }}</span>
                <span class="text-xs text-gray-500"
                  >Run multi-model AI scoring for today</span
                >
              </button>
            </template>
          </DropdownMenu>
          <router-link to="/" class="text-xs text-gray-500 hover:text-white">
            Public View
          </router-link>
        </div>
      </div>

      <!-- Action results -->
      <div
        v-if="fetchResult"
        class="mb-4 rounded-lg border px-4 py-2 text-sm"
        :class="
          fetchSuccess
            ? 'border-green-800 bg-green-950 text-green-300'
            : 'border-amber-800 bg-amber-950 text-amber-300'
        "
      >
        {{ fetchResult }}
      </div>
      <div
        v-if="scoreResult"
        class="mb-4 rounded-lg border px-4 py-2 text-sm"
        :class="
          scoreAlreadyExists
            ? 'border-amber-800 bg-amber-950 text-amber-300'
            : scoreSuccess
              ? 'border-green-800 bg-green-950 text-green-300'
              : 'border-red-800 bg-red-950 text-red-300'
        "
      >
        <div class="flex items-center justify-between gap-3">
          <span>{{ scoreResult }}</span>
          <button
            v-if="scoreAlreadyExists"
            :disabled="scoring"
            class="shrink-0 rounded border border-amber-700 bg-amber-900/50 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-800 disabled:opacity-50"
            @click="rescoreScore()"
          >
            {{ scoring ? "Regenerating..." : "Force Regenerate" }}
          </button>
        </div>
      </div>

      <!-- Auth prompt -->
      <div v-if="needsAuth" class="mx-auto max-w-sm py-20">
        <p class="mb-4 text-center text-sm text-gray-400">
          Enter admin key to access the dashboard
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
        <p v-if="error" class="mt-3 text-center text-sm text-red-400">
          {{ error }}
        </p>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="py-20 text-center">
        <p class="mb-4 text-sm text-red-400">{{ error }}</p>
        <div class="flex justify-center gap-3">
          <button
            class="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
            @click="fetchDashboard"
          >
            Retry
          </button>
          <button
            class="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:border-red-700 hover:text-red-300"
            @click="clearAdminKey"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Dashboard content -->
      <template v-else-if="data">
        <!-- Stats row -->
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard :value="data.totalScores" label="Total Scores" :index="0" />
          <StatCard
            :value="data.totalArticles"
            label="Total Articles"
            :index="1"
          />
          <StatCard
            :value="formatTokens(data.ai.totalTokens)"
            label="Tokens (recent)"
            :index="2"
          />
          <StatCard
            :value="data.totalSubscribers"
            label="Subscribers"
            :index="3"
          />
        </div>

        <!-- AI Usage -->
        <motion.section
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.15 }"
        >
          <h2
            class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            AI Usage
          </h2>
          <DataTable
            :columns="[
              { key: 'when', label: 'When' },
              { key: 'provider', label: 'Provider' },
              { key: 'model', label: 'Model' },
              { key: 'in', label: 'In' },
              { key: 'out', label: 'Out' },
              { key: 'latency', label: 'Latency' },
              { key: 'status', label: 'Status' },
            ]"
            :row-count="data.ai.recentCalls.length"
            empty-message="No AI usage recorded yet"
          >
            <tr
              v-for="call in data.ai.recentCalls"
              :key="call.id"
              class="border-b border-gray-800/50"
            >
              <td class="px-3 py-2 text-gray-300">
                {{ timeAgo(call.createdAt) }}
              </td>
              <td class="px-3 py-2">{{ call.provider }}</td>
              <td class="px-3 py-2 text-xs text-gray-400">
                {{ formatModelName(call.model) }}
              </td>
              <td class="px-3 py-2">
                {{ formatTokens(call.inputTokens) }}
              </td>
              <td class="px-3 py-2">
                {{ formatTokens(call.outputTokens) }}
              </td>
              <td class="px-3 py-2">
                {{
                  call.latencyMs
                    ? `${(call.latencyMs / 1000).toFixed(1)}s`
                    : "-"
                }}
              </td>
              <td class="px-3 py-2">
                <span
                  :class="{
                    'text-green-400': call.status === 'success',
                    'text-amber-400': call.status === 'rate_limited',
                    'text-red-400': call.status === 'error',
                  }"
                >
                  {{ call.status }}
                </span>
              </td>
            </tr>
          </DataTable>
        </motion.section>

        <!-- Source Health -->
        <motion.section
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.25 }"
        >
          <h2
            class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Sources
          </h2>
          <DataTable
            :columns="[
              { key: 'source', label: 'Source' },
              { key: 'pillar', label: 'Pillar' },
              { key: 'articles', label: 'Articles' },
              { key: 'lastFetched', label: 'Last Fetched' },
            ]"
            :row-count="data.sources.length"
            empty-message="No sources tracked"
          >
            <tr
              v-for="source in data.sources"
              :key="source.sourceName"
              class="border-b border-gray-800/50"
            >
              <td class="px-3 py-2 font-medium text-white">
                {{ source.sourceName }}
              </td>
              <td class="px-3 py-2">
                <span
                  :class="{
                    'text-purple-400': source.pillar === 'capability',
                    'text-blue-400': source.pillar === 'labour_market',
                    'text-green-400': source.pillar === 'sentiment',
                    'text-yellow-400': source.pillar === 'industry',
                    'text-gray-400': source.pillar === 'barriers',
                  }"
                >
                  {{ source.pillar }}
                </span>
              </td>
              <td class="px-3 py-2">{{ source.articleCount }}</td>
              <td class="px-3 py-2 text-gray-300">
                {{ timeAgo(source.lastFetched) }}
              </td>
            </tr>
          </DataTable>
        </motion.section>

        <!-- Logs -->
        <motion.section
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.35 }"
        >
          <LogViewer :admin-key="adminKey" />
        </motion.section>

        <!-- Refresh -->
        <div class="text-center">
          <button
            class="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
            @click="fetchDashboard"
          >
            Refresh
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
