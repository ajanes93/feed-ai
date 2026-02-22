<script setup lang="ts">
import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { Info } from "lucide-vue-next";

defineProps<{ text: string }>();

const isOpen = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);

onClickOutside(wrapperRef, () => {
  isOpen.value = false;
});
</script>

<template>
  <span ref="wrapperRef" class="relative inline-block align-middle">
    <button
      type="button"
      class="inline cursor-help text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
      :aria-expanded="isOpen"
      @click.stop.prevent="isOpen = !isOpen"
    >
      <Info class="h-3 w-3" />
    </button>
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        role="tooltip"
        class="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background shadow-lg"
      >
        {{ text }}
      </div>
    </Transition>
  </span>
</template>
