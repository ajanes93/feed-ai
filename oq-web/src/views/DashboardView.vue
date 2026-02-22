<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useHead } from "@unhead/vue";
import { motion } from "motion-v";
import { useDashboard } from "../composables/useDashboard";
import { timeAgo, formatTokens, formatModelName } from "@feed-ai/shared/utils";
import DataTable from "@feed-ai/shared/components/DataTable";
import StatCard from "@feed-ai/shared/components/StatCard";
import LogViewer from "@feed-ai/shared/components/LogViewer";
import { Button } from "@feed-ai/shared/components/ui/button";
import { Input } from "@feed-ai/shared/components/ui/input";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@feed-ai/shared/components/ui/dropdown-menu";
import { TableRow, TableCell } from "@feed-ai/shared/components/ui/table";
import { ChevronDown, RefreshCw, Rss, Sparkles } from "lucide-vue-next";

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

useHead({
  title: "Dashboard — One Question",
  meta: [
    { property: "og:title", content: "Dashboard — One Question" },
    {
      property: "og:description",
      content:
        "Admin dashboard — source health, AI usage, and score management.",
    },
  ],
});

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
  <div class="h-[100dvh] overflow-y-auto bg-background p-4 text-foreground">
    <div class="mx-auto max-w-5xl">
      <!-- Header -->
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight">OQ Dashboard</h1>
        <div class="flex items-center gap-3">
          <DropdownMenu v-if="data && !needsAuth">
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                :disabled="fetching || scoring"
              >
                Actions
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-64">
              <DropdownMenuItem :disabled="fetching" @click="fetchArticles()">
                <Rss class="size-4" />
                <div class="flex flex-col">
                  <span class="font-medium">{{
                    fetching ? "Fetching..." : "Fetch Articles"
                  }}</span>
                  <span class="text-xs text-muted-foreground"
                    >Pull latest from all RSS sources</span
                  >
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem :disabled="scoring" @click="generateScore()">
                <Sparkles class="size-4" />
                <div class="flex flex-col">
                  <span class="font-medium">{{
                    scoring ? "Scoring..." : "Generate Score"
                  }}</span>
                  <span class="text-xs text-muted-foreground"
                    >Run multi-model AI scoring for today</span
                  >
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <router-link to="/">
            <Button variant="ghost" size="sm"> Public View </Button>
          </router-link>
        </div>
      </div>

      <!-- Action results -->
      <div
        v-if="fetchResult"
        class="mb-4 rounded-lg border px-4 py-3 text-sm"
        :class="
          fetchSuccess
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        "
      >
        {{ fetchResult }}
      </div>
      <div
        v-if="scoreResult"
        class="mb-4 rounded-lg border px-4 py-3 text-sm"
        :class="
          scoreAlreadyExists
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            : scoreSuccess
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
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
        <p class="mb-4 text-center text-sm text-muted-foreground">
          Enter admin key to access the dashboard
        </p>
        <form class="flex gap-2" @submit.prevent="submitKey">
          <Input
            v-model="keyInput"
            type="password"
            placeholder="Admin key"
            class="flex-1"
          />
          <Button type="submit"> Go </Button>
        </form>
        <p v-if="error" class="mt-3 text-center text-sm text-destructive">
          {{ error }}
        </p>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="flex justify-center py-20">
        <div
          class="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="py-20 text-center">
        <p class="mb-4 text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-center gap-3">
          <Button variant="outline" size="sm" @click="fetchDashboard">
            Retry
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="border-destructive/50 text-destructive hover:bg-destructive/10"
            @click="clearAdminKey"
          >
            Logout
          </Button>
        </div>
      </div>

      <!-- Dashboard content -->
      <template v-else-if="data">
        <!-- Stats row -->
        <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          class="mb-8"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.15 }"
        >
          <h2
            class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
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
            <TableRow v-for="call in data.ai.recentCalls" :key="call.id">
              <TableCell class="text-muted-foreground">
                {{ timeAgo(call.createdAt) }}
              </TableCell>
              <TableCell>{{ call.provider }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatModelName(call.model) }}
              </TableCell>
              <TableCell>
                {{ formatTokens(call.inputTokens) }}
              </TableCell>
              <TableCell>
                {{ formatTokens(call.outputTokens) }}
              </TableCell>
              <TableCell>
                {{
                  call.latencyMs
                    ? `${(call.latencyMs / 1000).toFixed(1)}s`
                    : "-"
                }}
              </TableCell>
              <TableCell>
                <Badge
                  :variant="
                    call.status === 'success'
                      ? 'success'
                      : call.status === 'rate_limited'
                        ? 'warning'
                        : 'error'
                  "
                >
                  {{ call.status }}
                </Badge>
              </TableCell>
            </TableRow>
          </DataTable>
        </motion.section>

        <!-- Sources -->
        <motion.section
          class="mb-8"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.25 }"
        >
          <h2
            class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
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
            <TableRow v-for="source in data.sources" :key="source.sourceName">
              <TableCell class="font-medium text-foreground">
                {{ source.sourceName }}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {{ source.pillar }}
                </Badge>
              </TableCell>
              <TableCell>{{ source.articleCount }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ timeAgo(source.lastFetched) }}
              </TableCell>
            </TableRow>
          </DataTable>
        </motion.section>

        <!-- Logs -->
        <motion.section
          class="mb-8"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.35 }"
        >
          <LogViewer :admin-key="adminKey" />
        </motion.section>

        <!-- Refresh -->
        <div class="pb-6 text-center">
          <Button variant="outline" @click="fetchDashboard">
            <RefreshCw class="size-4" />
            Refresh
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
