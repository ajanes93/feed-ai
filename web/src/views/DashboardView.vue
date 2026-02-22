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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@feed-ai/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@feed-ai/shared/components/ui/dropdown-menu";
import { TableRow, TableCell } from "@feed-ai/shared/components/ui/table";
import {
  ChevronDown,
  RefreshCw,
  Rss,
  Sparkles,
  ListPlus,
  MessageSquare,
} from "lucide-vue-next";

const {
  data,
  loading,
  error,
  needsAuth,
  adminKey,
  fetching,
  fetchResult,
  fetchSuccess,
  rebuilding,
  rebuildResult,
  rebuildSuccess,
  enriching,
  enrichResult,
  enrichSuccess,
  setAdminKey,
  fetchDashboard,
  fetchSources,
  rebuildDigest,
  appendToDigest,
  enrichComments,
} = useDashboard();

useHead({
  title: "Dashboard — feed-ai",
  meta: [
    { property: "og:title", content: "Dashboard — feed-ai" },
    {
      property: "og:description",
      content:
        "Admin dashboard — source health, AI usage, and digest management.",
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
  <div
    class="bg-background text-foreground h-[100dvh] overflow-y-auto p-4 sm:p-6"
  >
    <div class="mx-auto max-w-5xl">
      <!-- Header -->
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div class="flex items-center gap-3">
          <DropdownMenu v-if="data && !needsAuth">
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                data-testid="actions-trigger"
                :disabled="fetching || rebuilding || enriching"
              >
                Actions
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-64">
              <DropdownMenuItem
                data-testid="action-fetch"
                :disabled="fetching"
                @click="fetchSources()"
              >
                <Rss class="size-4" />
                <div class="flex flex-col">
                  <span class="font-medium">{{
                    fetching ? "Fetching..." : "Fetch Sources"
                  }}</span>
                  <span class="text-muted-foreground text-xs"
                    >Pull latest from all RSS/API sources</span
                  >
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="action-rebuild"
                :disabled="rebuilding"
                @click="rebuildDigest()"
              >
                <Sparkles class="size-4" />
                <div class="flex flex-col">
                  <span class="font-medium">{{
                    rebuilding ? "Rebuilding..." : "Rebuild Digest"
                  }}</span>
                  <span class="text-muted-foreground text-xs"
                    >Delete today's digest and regenerate</span
                  >
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="action-append"
                :disabled="rebuilding"
                @click="appendToDigest()"
              >
                <ListPlus class="size-4" />
                <div class="flex flex-col">
                  <span class="font-medium">{{
                    rebuilding ? "Appending..." : "Append New Items"
                  }}</span>
                  <span class="text-muted-foreground text-xs"
                    >Add unsummarized items to today's digest</span
                  >
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="action-enrich"
                :disabled="enriching"
                @click="enrichComments()"
              >
                <MessageSquare class="size-4" />
                <div class="flex flex-col">
                  <span class="font-medium">{{
                    enriching ? "Enriching..." : "Enrich Comments"
                  }}</span>
                  <span class="text-muted-foreground text-xs"
                    >Fetch and summarize Reddit/HN comments</span
                  >
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <router-link to="/">
            <Button
              variant="ghost"
              size="sm"
            >
              Feed
            </Button>
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
        v-if="rebuildResult"
        class="mb-4 rounded-lg border px-4 py-3 text-sm"
        :class="
          rebuildSuccess
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        "
      >
        {{ rebuildResult }}
      </div>
      <div
        v-if="enrichResult"
        class="mb-4 rounded-lg border px-4 py-3 text-sm"
        :class="
          enrichSuccess
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        "
      >
        {{ enrichResult }}
      </div>

      <!-- Auth prompt -->
      <div
        v-if="needsAuth"
        class="flex items-center justify-center py-20"
      >
        <Card class="w-full max-w-sm">
          <CardHeader class="text-center">
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Enter admin key to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              class="flex gap-2"
              @submit.prevent="submitKey"
            >
              <Input
                v-model="keyInput"
                type="password"
                placeholder="Admin key"
                class="flex-1"
              />
              <Button type="submit"> Go </Button>
            </form>
            <p
              v-if="error"
              class="text-destructive mt-3 text-center text-sm"
            >
              {{ error }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Loading -->
      <div
        v-else-if="loading"
        class="flex justify-center py-20"
      >
        <div
          class="border-muted border-t-foreground size-8 animate-spin rounded-full border-2"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="text-destructive py-20 text-center text-sm"
      >
        {{ error }}
      </div>

      <!-- Dashboard content -->
      <template v-else-if="data">
        <!-- Stats row -->
        <div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          class="mb-8"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.15 }"
        >
          <h2
            class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase"
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
            <TableRow
              v-for="call in data.ai.recentCalls"
              :key="call.id"
            >
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
                  <span
                    v-if="call.wasFallback"
                    class="opacity-60"
                  >
                    (fallback)
                  </span>
                </Badge>
              </TableCell>
            </TableRow>
          </DataTable>
        </motion.section>

        <!-- Source Health -->
        <motion.section
          class="mb-8"
          :initial="{ opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.35, delay: 0.25 }"
        >
          <h2
            class="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase"
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
            <TableRow
              v-for="source in data.sources"
              :key="source.sourceId"
            >
              <TableCell class="text-foreground font-medium">
                {{ source.sourceName }}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {{ source.category }}
                </Badge>
              </TableCell>
              <TableCell>{{ source.itemCount }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ timeAgo(source.lastSuccessAt) }}
              </TableCell>
              <TableCell>
                <span
                  :class="
                    source.consecutiveFailures > 0
                      ? 'text-red-400'
                      : 'text-muted-foreground'
                  "
                >
                  {{ source.consecutiveFailures }}
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  :variant="
                    source.stale
                      ? 'error'
                      : source.itemCount === 0
                        ? 'warning'
                        : 'success'
                  "
                >
                  {{
                    source.stale
                      ? "Stale"
                      : source.itemCount === 0
                        ? "Check"
                        : "OK"
                  }}
                </Badge>
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
          <Button
            variant="outline"
            @click="fetchDashboard"
          >
            <RefreshCw class="size-4" />
            Refresh
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
