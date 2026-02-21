<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useLogs, type LogEntry } from "../composables/useLogs";
import { timeAgo } from "../utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";

const props = defineProps<{
  adminKey: string;
  baseUrl?: string;
}>();

const {
  logs,
  loading,
  levelFilter,
  categoryFilter,
  categories,
  fetchLogs,
  setLevel,
  setCategory,
} = useLogs(
  () => props.adminKey,
  () => props.baseUrl ?? "",
);

const levels = ["error", "warn", "info"] as const;

function levelVariant(entry: LogEntry): "error" | "warning" | "secondary" {
  if (entry.level === "error") return "error";
  if (entry.level === "warn") return "warning";
  return "secondary";
}

watch(
  () => props.adminKey,
  (key) => {
    if (key) fetchLogs();
  },
);

onMounted(() => {
  if (props.adminKey) fetchLogs();
});
</script>

<template>
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Logs
      </h2>
      <div
        v-if="loading"
        class="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground"
      />
    </div>

    <!-- Filters -->
    <div class="mb-3 flex flex-wrap gap-1.5">
      <!-- Level filters -->
      <Button
        :variant="levelFilter === null ? 'secondary' : 'ghost'"
        size="sm"
        class="h-7 px-2.5 text-xs"
        @click="setLevel(null)"
      >
        All
      </Button>
      <Button
        v-for="lv in levels"
        :key="lv"
        :variant="levelFilter === lv ? 'secondary' : 'ghost'"
        size="sm"
        class="h-7 px-2.5 text-xs"
        @click="setLevel(lv)"
      >
        {{ lv }}
      </Button>

      <!-- Category separator -->
      <span
        v-if="categories.length > 0"
        class="mx-1 border-l border-border"
      />

      <!-- Category filters -->
      <Button
        v-if="categories.length > 0"
        :variant="categoryFilter === null ? 'secondary' : 'ghost'"
        size="sm"
        class="h-7 px-2.5 text-xs"
        @click="setCategory(null)"
      >
        all categories
      </Button>
      <Button
        v-for="cat in categories"
        :key="cat"
        :variant="categoryFilter === cat ? 'secondary' : 'ghost'"
        size="sm"
        class="h-7 px-2.5 text-xs"
        @click="setCategory(cat)"
      >
        {{ cat }}
      </Button>
    </div>

    <!-- Table -->
    <div class="overflow-hidden rounded-xl border border-border bg-card/50">
      <Table>
        <TableHeader>
          <TableRow class="border-border/50 hover:bg-transparent">
            <TableHead
              class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              When
            </TableHead>
            <TableHead
              class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Level
            </TableHead>
            <TableHead
              class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Category
            </TableHead>
            <TableHead
              class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Message
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="logs.length > 0">
            <TableRow
              v-for="entry in logs"
              :key="entry.id"
            >
              <TableCell class="text-muted-foreground">
                {{ timeAgo(entry.createdAt) }}
              </TableCell>
              <TableCell>
                <Badge :variant="levelVariant(entry)">
                  {{ entry.level }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ entry.category }}
              </TableCell>
              <TableCell class="max-w-md truncate text-muted-foreground">
                {{ entry.message }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow
            v-else
            class="hover:bg-transparent"
          >
            <TableCell
              colspan="4"
              class="py-8 text-center text-muted-foreground"
            >
              No logs found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </section>
</template>
