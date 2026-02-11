<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

function openAi() {
  router.push("/ai");
}
</script>

<template>
  <button
    class="fab fixed right-5 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:bg-blue-400 hover:shadow-blue-400/30 active:scale-95"
    aria-label="Open AI Assistant"
    @click="openAi"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-white"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2l2.09 6.26L20.18 9l-5.09 3.74L17.18 19 12 15.27 6.82 19l2.09-6.26L3.82 9l6.09-.74z"
      />
    </svg>
  </button>
</template>

<style scoped>
.fab {
  animation: fab-glow 3s ease-in-out infinite;
}

@keyframes fab-glow {
  0%,
  100% {
    box-shadow:
      0 4px 12px rgba(59, 130, 246, 0.25),
      0 0 0 0 rgba(59, 130, 246, 0);
  }
  50% {
    box-shadow:
      0 4px 16px rgba(59, 130, 246, 0.35),
      0 0 0 6px rgba(59, 130, 246, 0.08);
  }
}
</style>
