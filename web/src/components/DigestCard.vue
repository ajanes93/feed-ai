<script setup lang="ts">
import type { DigestItem } from '../types';

defineProps<{
  item: DigestItem;
}>();

const categoryEmoji: Record<string, string> = {
  ai: '🤖',
  jobs: '💼',
  dev: '⚡',
  news: '📰',
  competitors: '👀'
};

const categoryColor: Record<string, string> = {
  ai: 'text-purple-400',
  jobs: 'text-green-400',
  dev: 'text-blue-400',
  news: 'text-orange-400',
  competitors: 'text-red-400'
};
</script>

<template>
  <div class="h-screen snap-start snap-always flex flex-col justify-center px-6 py-12">
    <div class="max-w-lg mx-auto">
      <!-- Category badge -->
      <span :class="['text-sm font-medium', categoryColor[item.category] || 'text-gray-400']">
        {{ categoryEmoji[item.category] || '📌' }} {{ item.category.toUpperCase() }}
      </span>

      <!-- Title -->
      <h1 class="text-2xl font-bold text-white mt-3 leading-tight">
        {{ item.title }}
      </h1>

      <!-- Summary -->
      <p class="text-gray-300 mt-4 text-lg leading-relaxed">
        {{ item.summary }}
      </p>

      <!-- Why it matters -->
      <p v-if="item.whyItMatters" class="text-blue-400 mt-4 text-base italic">
        → {{ item.whyItMatters }}
      </p>

      <!-- Source link -->
      <a
        :href="item.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 mt-6 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>{{ item.sourceName }}</span>
        <span>↗</span>
      </a>
    </div>
  </div>
</template>
