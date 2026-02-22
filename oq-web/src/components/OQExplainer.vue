<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@feed-ai/shared/components/ui/tooltip";
import { Info } from "lucide-vue-next";

defineProps<{ text: string }>();
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <Info
          class="inline h-3 w-3 cursor-help text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
        />
      </TooltipTrigger>
      <TooltipContent class="max-w-xs text-xs">
        {{ text }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
