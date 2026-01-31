<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div
    class="flex h-[100dvh] flex-col items-center justify-center px-6 text-center"
  >
    <span class="mb-4 animate-bounce-gentle text-6xl">
      📭
    </span>
    <p class="animate-fade-in text-lg text-gray-400">
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
@keyframes bounce-gentle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-bounce-gentle {
  animation: bounce-gentle 2.5s ease-in-out infinite;
}
.animate-fade-in {
  animation: fade-in 0.5s ease-out 0.2s both;
}
</style>
