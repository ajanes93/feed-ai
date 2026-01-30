<script setup lang="ts">
defineProps<{
  columns: { key: string; label: string }[];
  emptyMessage?: string;
}>();
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-gray-800">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-gray-800 bg-gray-900/50 text-xs text-gray-400">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <slot />
        <slot name="empty">
          <tr>
            <td
              :colspan="columns.length"
              class="px-3 py-6 text-center text-gray-500"
            >
              {{ emptyMessage || "No data" }}
            </td>
          </tr>
        </slot>
      </tbody>
    </table>
  </div>
</template>
