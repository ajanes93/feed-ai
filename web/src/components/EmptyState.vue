<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div
    class="flex h-[100dvh] flex-col items-center justify-center px-6 text-center"
  >
    <span class="empty-icon mb-4 text-6xl">📭</span>
    <p class="empty-text text-lg text-gray-400">{{ message }}</p>
  </div>
</template>

<style scoped>
.empty-icon {
  animation: floatBounce 2.5s ease-in-out infinite;
}

@keyframes floatBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.empty-text {
  animation: fadeIn 0.5s ease-out both;
  animation-delay: 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
