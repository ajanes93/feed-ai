<script setup lang="ts">
import { ref, computed } from "vue";
import type { OQSignal } from "@feed-ai/shared/oq-types";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
} from "@feed-ai/shared/components/ui/collapsible";
import { ExternalLink, ChevronDown } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    signals: OQSignal[];
    initialCount?: number;
  }>(),
  { initialCount: 5 }
);

const isOpen = ref(false);
const hiddenCount = computed(() => props.signals.length - props.initialCount);
</script>

<template>
  <div class="flex flex-col gap-2">
    <component
      :is="signal.url ? 'a' : 'div'"
      v-for="(signal, i) in signals"
      v-show="i < initialCount || isOpen"
      :key="signal.text + signal.source"
      :href="signal.url"
      :target="signal.url ? '_blank' : undefined"
      :rel="signal.url ? 'noopener noreferrer' : undefined"
      class="flex items-center gap-3 rounded-xl border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground transition-colors"
      :class="
        signal.url
          ? 'border-border/50 active:bg-secondary/80 hover:border-border'
          : 'border-transparent'
      "
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
      <span
        v-if="signal.url"
        class="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground/60"
      >
        {{ signal.source }}
        <ExternalLink data-testid="signal-external-link" class="h-2.5 w-2.5" />
      </span>
      <span
        v-else
        class="shrink-0 font-mono text-[10px] text-muted-foreground/40"
      >
        {{ signal.source }}
      </span>
    </component>

    <Collapsible v-if="hiddenCount > 0" v-model:open="isOpen">
      <CollapsibleTrigger
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/50 py-2.5 text-[11px] text-muted-foreground/60 transition-colors hover:border-border hover:text-muted-foreground"
      >
        <span>+ {{ hiddenCount }} more signals</span>
        <ChevronDown
          class="h-3 w-3 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </CollapsibleTrigger>
    </Collapsible>
  </div>
</template>
