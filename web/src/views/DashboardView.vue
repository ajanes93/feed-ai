<script setup lang="ts">
import { onMounted, ref } from "vue";
import { motion } from "motion-v";
import { useDashboard } from "../composables/useDashboard";
import { timeAgo, formatTokens } from "../utils/formatting";
import DataTable from "../components/DataTable.vue";
import StatCard from "../components/StatCard.vue";

const {
  data,
  loading,
  error,
  needsAuth,
  rebuilding,
  rebuildResult,
  setAdminKey,
  fetchDashboard,
  rebuildDigest,
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
        <h1 class="text-xl font-semibold text-white">Dashboard</h1>
        <div class="flex items-center gap-3">
          <button
            v-if="data && !needsAuth"
            :disabled="rebuilding"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            @click="rebuildDigest"
          >
            {{ rebuilding ? "Rebuilding..." : "Refresh Digest" }}
          </button>
          <router-link
            to="/"
            class="text-sm text-gray-400 hover:text-white"
          >
            Back to Feed
          </router-link>
        </div>
      </div>

      <!-- Rebuild result -->
      <div
        v-if="rebuildResult"
        class="mb-4 rounded-lg border px-4 py-2 text-sm"
        :class="
          rebuildResult.includes('Generated')
            ? 'border-green-800 bg-green-950 text-green-300'
            : 'border-amber-800 bg-amber-950 text-amber-300'
        "
      >
        {{ rebuildResult }}
      </div>

      <!-- Auth prompt -->
      <div
        v-if="needsAuth"
        class="mx-auto max-w-sm py-20"
      >
        <p class="mb-4 text-center text-sm text-gray-400">
          Enter admin key to access the dashboard
        </p>
        <form
          class="flex gap-2"
          @submit.prevent="submitKey"
        >
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
        <p
          v-if="error"
          class="mt-3 text-center text-sm text-red-400"
        >
          {{ error }}
        </p>
      </div>

      <!-- Loading -->
      <div
        v-else-if="loading"
        class="flex justify-center py-20"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="py-20 text-center text-sm text-red-400"
      >
        {{ error }}
      </div>

      <!-- Dashboard content -->
      <template v-else-if="data">
        <!-- Stats row -->
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            :value="data.totalDigests"
            label="Total Digests"
            :index="0"
          />
          <StatCard
            :value="formatTokens(data.ai.totalTokens)"
            label="Tokens (last 30)"
            :index="1"
          />
          <StatCard
            :value="data.ai.rateLimitCount"
            label="Rate Limits (last 30)"
            :highlight="data.ai.rateLimitCount > 0"
            :index="2"
          />
          <StatCard
            :value="data.ai.fallbackCount"
            label="Fallbacks (last 30)"
            :highlight="data.ai.fallbackCount > 0"
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
                {{ call.model.replace(/-.{8,}$/, "") }}
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
                  <span
                    v-if="call.wasFallback"
                    class="text-xs text-gray-500"
                  >
                    (fallback)
                  </span>
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
            Source Health
          </h2>
          <DataTable
            :columns="[
              { key: 'source', label: 'Source' },
              { key: 'category', label: 'Category' },
              { key: 'items', label: 'Items' },
              { key: 'lastOk', label: 'Last OK' },
              { key: 'failures', label: 'Failures' },
              { key: 'status', label: 'Status' },
            ]"
            :row-count="data.sources.length"
            empty-message="No sources tracked"
          >
            <tr
              v-for="source in data.sources"
              :key="source.sourceId"
              class="border-b border-gray-800/50"
            >
              <td class="px-3 py-2 font-medium text-white">
                {{ source.sourceName }}
              </td>
              <td class="px-3 py-2">
                <span
                  :class="{
                    'text-purple-400': source.category === 'ai',
                    'text-blue-400': source.category === 'dev',
                    'text-green-400': source.category === 'jobs',
                  }"
                >
                  {{ source.category }}
                </span>
              </td>
              <td class="px-3 py-2">{{ source.itemCount }}</td>
              <td class="px-3 py-2 text-gray-300">
                {{ timeAgo(source.lastSuccessAt) }}
              </td>
              <td class="px-3 py-2">
                <span
                  :class="
                    source.consecutiveFailures > 0
                      ? 'text-red-400'
                      : 'text-gray-500'
                  "
                >
                  {{ source.consecutiveFailures }}
                </span>
              </td>
              <td class="px-3 py-2">
                <span :class="source.stale ? 'text-red-400' : 'text-green-400'">
                  {{ source.stale ? "Stale" : "OK" }}
                </span>
              </td>
            </tr>
          </DataTable>
        </motion.section>

        <!-- Error Logs -->
        <motion.section
          class="mb-6"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.35 }"
        >
          <h2
            class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase"
          >
            Recent Errors
          </h2>
          <DataTable
            :columns="[
              { key: 'when', label: 'When' },
              { key: 'level', label: 'Level' },
              { key: 'category', label: 'Category' },
              { key: 'message', label: 'Message' },
            ]"
            :row-count="data.errors.length"
            empty-message="No errors recorded"
          >
            <tr
              v-for="err in data.errors"
              :key="err.id"
              class="border-b border-gray-800/50"
            >
              <td class="px-3 py-2 text-gray-300">
                {{ timeAgo(err.createdAt) }}
              </td>
              <td class="px-3 py-2">
                <span
                  :class="{
                    'text-red-400': err.level === 'error',
                    'text-amber-400': err.level === 'warn',
                    'text-gray-400': err.level === 'info',
                  }"
                >
                  {{ err.level }}
                </span>
              </td>
              <td class="px-3 py-2">{{ err.category }}</td>
              <td class="max-w-md truncate px-3 py-2 text-gray-300">
                {{ err.message }}
              </td>
            </tr>
          </DataTable>
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
