<script setup lang="ts">
defineProps<{
  to50: string[];
  to70: string[];
  below20: string[];
}>();

const sections = [
  {
    key: "to50" as const,
    label: "To 50+",
    description: "What would move the score above 50%",
  },
  {
    key: "to70" as const,
    label: "To 70+",
    description: "What would push toward likely replacement",
  },
  {
    key: "below20" as const,
    label: "Below 20",
    description: "What would push toward unlikely",
  },
];
</script>

<template>
  <div class="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
    <div class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
      What Would Move This Score?
    </div>
    <p class="mb-6 text-xs leading-relaxed text-gray-500">
      Transparency matters. Here's exactly what would change the number.
    </p>

    <div class="space-y-6">
      <div v-for="section in sections" :key="section.key">
        <div class="mb-2 flex items-center gap-2">
          <span
            class="inline-flex h-5 min-w-[3.5rem] items-center justify-center rounded-full px-2 text-[10px] font-semibold tracking-wide"
            :class="{
              'bg-yellow-500/10 text-yellow-500': section.key === 'to50',
              'bg-red-500/10 text-red-400': section.key === 'to70',
              'bg-emerald-500/10 text-emerald-400': section.key === 'below20',
            }"
          >
            {{ section.label }}
          </span>
          <span class="text-xs text-gray-600">{{ section.description }}</span>
        </div>
        <ul class="space-y-1.5 pl-1">
          <li
            v-for="(item, i) in $props[section.key]"
            :key="i"
            class="flex items-start gap-2 text-sm leading-relaxed text-gray-400"
          >
            <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-700" />
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
