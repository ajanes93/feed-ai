<script setup lang="ts">
import { useRouter } from "vue-router";
import { Button } from "@feed-ai/shared/components/ui/button";
import { Sparkles } from "lucide-vue-next";

const router = useRouter();

function openAi() {
  router.push("/ai");
}
</script>

<template>
  <Button
    class="fab fixed right-5 bottom-6 z-50 h-12 w-12 rounded-full bg-blue-500 shadow-lg shadow-blue-500/25 hover:bg-blue-400 hover:shadow-blue-400/30 active:scale-95"
    size="icon"
    aria-label="Open AI Assistant"
    @click="openAi"
  >
    <Sparkles class="h-5 w-5 text-white" />
  </Button>
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
