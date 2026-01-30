<script setup lang="ts">
import { useDashboard } from "../composables/useDashboard";

const { data, loading, error, adminKey, fetchDashboard } = useDashboard();

function timeAgo(unixTs: number | null): string {
  if (!unixTs) return "Never";
  const seconds = Math.floor(Date.now() / 1000 - unixTs);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTokens(n: number | null): string {
  if (n === null || n === undefined) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
</script>

<template>
  <div class="min-h-[100dvh] bg-gray-950 p-4 text-gray-100">
    <div class="mx-auto max-w-4xl">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-white">Dashboard</h1>
        <router-link
          to="/"
          class="text-sm text-gray-400 hover:text-white"
        >
          Back to Feed
        </router-link>
      </div>

      <!-- Auth -->
      <div
        v-if="!data && !loading"
        class="mx-auto max-w-sm"
      >
        <form
          class="flex flex-col gap-3"
          @submit.prevent="fetchDashboard"
        >
          <input
            v-model="adminKey"
            type="password"
            placeholder="Admin key"
            class="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect
          </button>
          <p
            v-if="error"
            class="text-center text-sm text-red-400"
          >
            {{ error }}
          </p>
        </form>
      </div>

      <!-- Loading -->
      <div
        v-else-if="loading"
        class="flex justify-center py-20"
      >
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white" />
      </div>

      <!-- Dashboard content -->
      <template v-else-if="data">
        <!-- Stats row -->
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div class="text-2xl font-bold text-white">
              {{ data.totalDigests }}
            </div>
            <div class="text-xs text-gray-400">Total Digests</div>
          </div>
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div class="text-2xl font-bold text-white">
              {{ formatTokens(data.ai.totalTokens) }}
            </div>
            <div class="text-xs text-gray-400">Tokens (last 30)</div>
          </div>
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div
              class="text-2xl font-bold"
              :class="
                data.ai.rateLimitCount > 0 ? 'text-amber-400' : 'text-white'
              "
            >
              {{ data.ai.rateLimitCount }}
            </div>
            <div class="text-xs text-gray-400">Rate Limits (last 30)</div>
          </div>
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div
              class="text-2xl font-bold"
              :class="
                data.ai.fallbackCount > 0 ? 'text-amber-400' : 'text-white'
              "
            >
              {{ data.ai.fallbackCount }}
            </div>
            <div class="text-xs text-gray-400">Fallbacks (last 30)</div>
          </div>
        </div>

        <!-- AI Usage -->
        <section class="mb-6">
          <h2 class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">
            AI Usage
          </h2>
          <div class="overflow-x-auto rounded-xl border border-gray-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-800 bg-gray-900/50 text-xs text-gray-400">
                <tr>
                  <th class="px-3 py-2">When</th>
                  <th class="px-3 py-2">Provider</th>
                  <th class="px-3 py-2">Model</th>
                  <th class="px-3 py-2">In</th>
                  <th class="px-3 py-2">Out</th>
                  <th class="px-3 py-2">Latency</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
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
                    {{ call.latencyMs ? `${(call.latencyMs / 1000).toFixed(1)}s` : "-" }}
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
                <tr v-if="data.ai.recentCalls.length === 0">
                  <td
                    colspan="7"
                    class="px-3 py-6 text-center text-gray-500"
                  >
                    No AI usage recorded yet
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Source Health -->
        <section class="mb-6">
          <h2 class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">
            Source Health
          </h2>
          <div class="overflow-x-auto rounded-xl border border-gray-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-800 bg-gray-900/50 text-xs text-gray-400">
                <tr>
                  <th class="px-3 py-2">Source</th>
                  <th class="px-3 py-2">Category</th>
                  <th class="px-3 py-2">Items</th>
                  <th class="px-3 py-2">Last OK</th>
                  <th class="px-3 py-2">Failures</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
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
                    <span
                      :class="source.stale ? 'text-red-400' : 'text-green-400'"
                    >
                      {{ source.stale ? "Stale" : "OK" }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Error Logs -->
        <section class="mb-6">
          <h2 class="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">
            Recent Errors
          </h2>
          <div class="overflow-x-auto rounded-xl border border-gray-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-gray-800 bg-gray-900/50 text-xs text-gray-400">
                <tr>
                  <th class="px-3 py-2">When</th>
                  <th class="px-3 py-2">Level</th>
                  <th class="px-3 py-2">Category</th>
                  <th class="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
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
                <tr v-if="data.errors.length === 0">
                  <td
                    colspan="4"
                    class="px-3 py-6 text-center text-gray-500"
                  >
                    No errors recorded
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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
