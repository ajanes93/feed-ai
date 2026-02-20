<script setup lang="ts">
import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { motion, AnimatePresence } from "motion-v";

defineProps<{
  label: string;
  disabled?: boolean;
}>();

const open = ref(false);
const menuRef = ref<HTMLElement>();

onClickOutside(menuRef, () => {
  open.value = false;
});

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}
</script>

<template>
  <div
    ref="menuRef"
    class="relative"
  >
    <button
      type="button"
      :disabled="disabled"
      class="flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
      @click="toggle"
    >
      {{ label }}
      <svg
        class="h-3 w-3 transition-transform"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <AnimatePresence>
      <motion.div
        v-if="open"
        :initial="{ opacity: 0, scale: 0.95, y: -4 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="{ opacity: 0, scale: 0.95, y: -4 }"
        :transition="{ duration: 0.15 }"
        class="absolute right-0 z-50 mt-1 min-w-48 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
      >
        <slot :close="close" />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
