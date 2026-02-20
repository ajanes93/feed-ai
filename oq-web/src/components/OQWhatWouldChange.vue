<script setup lang="ts">
defineProps<{
  to50: string[];
  to70: string[];
  below20: string[];
}>();
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
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="inline-flex h-5 min-w-[3.5rem] items-center justify-center rounded-full bg-yellow-500/10 px-2 text-[10px] font-semibold tracking-wide text-yellow-500"
          >
            To 50+
          </span>
          <span class="text-xs text-gray-600"
            >What would move the score above 50%</span
          >
        </div>
        <ul class="space-y-1.5 pl-1">
          <li
            v-for="(item, i) in to50"
            :key="i"
            class="flex items-start gap-2 text-sm leading-relaxed text-gray-400"
          >
            <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-700" />
            {{ item }}
          </li>
        </ul>
      </div>

      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="inline-flex h-5 min-w-[3.5rem] items-center justify-center rounded-full bg-red-500/10 px-2 text-[10px] font-semibold tracking-wide text-red-400"
          >
            To 70+
          </span>
          <span class="text-xs text-gray-600"
            >What would push toward likely replacement</span
          >
        </div>
        <ul class="space-y-1.5 pl-1">
          <li
            v-for="(item, i) in to70"
            :key="i"
            class="flex items-start gap-2 text-sm leading-relaxed text-gray-400"
          >
            <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-700" />
            {{ item }}
          </li>
        </ul>
      </div>

      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="inline-flex h-5 min-w-[3.5rem] items-center justify-center rounded-full bg-emerald-500/10 px-2 text-[10px] font-semibold tracking-wide text-emerald-400"
          >
            Below 20
          </span>
          <span class="text-xs text-gray-600"
            >What would push toward unlikely</span
          >
        </div>
        <ul class="space-y-1.5 pl-1">
          <li
            v-for="(item, i) in below20"
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
