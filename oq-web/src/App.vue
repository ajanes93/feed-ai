<script setup lang="ts">
import { TooltipProvider } from "@feed-ai/shared/components/ui/tooltip";
</script>

<template>
  <TooltipProvider>
    <router-view />
  </TooltipProvider>
</template>
