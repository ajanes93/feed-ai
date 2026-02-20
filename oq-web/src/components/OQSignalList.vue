<script setup lang="ts">
import type { OQSignal } from "@feed-ai/shared/oq-types";

defineProps<{
  signals: OQSignal[];
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(signal, i) in signals"
      :key="i"
      class="flex items-center gap-3 rounded-xl border border-transparent bg-gray-800/50 px-4 py-3 text-sm text-gray-400 transition-colors hover:border-gray-700"
    >
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px]"
        :class="{
          'bg-red-500/10 text-red-400': signal.direction === 'up',
          'bg-emerald-500/10 text-emerald-400': signal.direction === 'down',
          'bg-yellow-500/10 text-yellow-400': signal.direction === 'neutral',
        }"
      >
        <span v-if="signal.direction === 'up'">▲</span>
        <span v-else-if="signal.direction === 'down'">▼</span>
        <span v-else>●</span>
      </span>
      <span class="flex-1">{{ signal.text }}</span>
      <span class="ml-auto shrink-0 font-mono text-[10px] text-gray-600">
        {{ signal.source }}
      </span>
    </div>
  </div>
</template>
