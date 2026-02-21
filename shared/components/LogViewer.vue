<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useLogs, type LogEntry } from "../composables/useLogs";
import { timeAgo } from "../utils";
import DataTable from "./DataTable.vue";

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

function levelClass(entry: LogEntry) {
  if (entry.level === "error") return "text-red-400";
  if (entry.level === "warn") return "text-amber-400";
  return "text-gray-400";
}

watch(() => props.adminKey, (key) => {
  if (key) fetchLogs();
});

onMounted(() => {
  if (props.adminKey) fetchLogs();
});
</script>

<template>
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-sm font-semibold tracking-wide text-gray-400 uppercase"
      >
        Logs
      </h2>
      <div
        v-if="loading"
        class="h-4 w-4 animate-spin rounded-full border border-gray-600 border-t-white"
      />
    </div>

    <!-- Filters -->
    <div class="mb-3 flex flex-wrap gap-2">
      <!-- Level filters -->
      <button
        class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
        :class="
          levelFilter === null
            ? 'border-gray-500 bg-gray-800 text-white'
            : 'border-gray-700 text-gray-500 hover:text-gray-300'
        "
        @click="setLevel(null)"
      >
        All
      </button>
      <button
        v-for="lv in levels"
        :key="lv"
        class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
        :class="
          levelFilter === lv
            ? lv === 'error'
              ? 'border-red-700 bg-red-950 text-red-300'
              : lv === 'warn'
                ? 'border-amber-700 bg-amber-950 text-amber-300'
                : 'border-gray-500 bg-gray-800 text-white'
            : 'border-gray-700 text-gray-500 hover:text-gray-300'
        "
        @click="setLevel(lv)"
      >
        {{ lv }}
      </button>

      <!-- Category separator -->
      <span
        v-if="categories.length > 0"
        class="border-l border-gray-700 mx-1"
      />

      <!-- Category filters -->
      <button
        v-if="categories.length > 0"
        class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
        :class="
          categoryFilter === null
            ? 'border-gray-500 bg-gray-800 text-white'
            : 'border-gray-700 text-gray-500 hover:text-gray-300'
        "
        @click="setCategory(null)"
      >
        all categories
      </button>
      <button
        v-for="cat in categories"
        :key="cat"
        class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
        :class="
          categoryFilter === cat
            ? 'border-gray-500 bg-gray-800 text-white'
            : 'border-gray-700 text-gray-500 hover:text-gray-300'
        "
        @click="setCategory(cat)"
      >
        {{ cat }}
      </button>
    </div>

    <!-- Table -->
    <DataTable
      :columns="[
        { key: 'when', label: 'When' },
        { key: 'level', label: 'Level' },
        { key: 'category', label: 'Category' },
        { key: 'message', label: 'Message' },
      ]"
      :row-count="logs.length"
      empty-message="No logs found"
    >
      <tr
        v-for="entry in logs"
        :key="entry.id"
        class="border-b border-gray-800/50"
      >
        <td class="whitespace-nowrap px-3 py-2 text-gray-300">
          {{ timeAgo(entry.createdAt) }}
        </td>
        <td class="px-3 py-2">
          <span :class="levelClass(entry)">{{ entry.level }}</span>
        </td>
        <td class="px-3 py-2">{{ entry.category }}</td>
        <td class="max-w-md truncate px-3 py-2 text-gray-300">
          {{ entry.message }}
        </td>
      </tr>
    </DataTable>
  </section>
</template>
