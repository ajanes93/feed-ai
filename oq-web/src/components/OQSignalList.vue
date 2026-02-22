<script setup lang="ts">
import type { OQSignal } from "@feed-ai/shared/oq-types";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import { ExternalLink } from "lucide-vue-next";

defineProps<{
  signals: OQSignal[];
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <component
      :is="signal.url ? 'a' : 'div'"
      v-for="signal in signals"
      :key="signal.text + signal.source"
      :href="signal.url"
      :target="signal.url ? '_blank' : undefined"
      :rel="signal.url ? 'noopener noreferrer' : undefined"
      class="flex items-center gap-3 rounded-xl border border-transparent bg-secondary/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-border"
    >
      <Badge
        :variant="
          signal.direction === 'up'
            ? 'error'
            : signal.direction === 'down'
              ? 'success'
              : 'warning'
        "
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md p-0 text-[10px]"
      >
        <span v-if="signal.direction === 'up'">▲</span>
        <span v-else-if="signal.direction === 'down'">▼</span>
        <span v-else>●</span>
      </Badge>
      <span class="flex-1">{{ signal.text }}</span>
      <ExternalLink
        v-if="signal.url"
        data-testid="signal-external-link"
        class="h-3 w-3 shrink-0 text-muted-foreground/40"
      />
      <span
        class="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground"
      >
        {{ signal.source }}
      </span>
    </component>
  </div>
</template>
