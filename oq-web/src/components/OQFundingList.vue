<script setup lang="ts">
import { ref, computed } from "vue";
import { ExternalLink } from "lucide-vue-next";

interface FundingEvent {
  company: string;
  amount?: string;
  round?: string;
  sourceUrl?: string;
  date?: string;
  relevance?: string;
}

const props = defineProps<{
  events: FundingEvent[];
}>();

const showAll = ref(false);

const visible = computed(() =>
  showAll.value ? props.events : props.events.slice(0, 3)
);
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(event, i) in visible"
      :key="i"
      class="flex flex-wrap items-center gap-1.5 text-xs"
      data-testid="funding-event"
    >
      <span class="font-medium text-foreground/80">{{ event.company }}</span>
      <span
        v-if="event.amount"
        class="rounded-md bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] text-orange-400"
        >{{ event.amount }}</span
      >
      <span v-if="event.round" class="text-muted-foreground/60">{{
        event.round
      }}</span>
      <span
        v-if="event.relevance"
        class="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground/50"
        >{{ event.relevance }}</span
      >
      <a
        v-if="event.sourceUrl"
        :href="event.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center text-muted-foreground/40 transition-colors hover:text-orange-500/60"
      >
        <ExternalLink class="h-2.5 w-2.5" />
      </a>
    </div>
    <button
      v-if="events.length > 3"
      class="mt-1 cursor-pointer text-[10px] text-muted-foreground/50 transition-colors hover:text-orange-500/60"
      @click="showAll = !showAll"
    >
      {{ showAll ? "Show less" : `Show all ${events.length} events` }}
    </button>
  </div>
</template>
