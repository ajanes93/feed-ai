<script setup lang="ts">
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";

defineProps<{
  verified: string;
  pro: string;
  note?: string;
}>();
</script>

<template>
  <Card class="border-border bg-card">
    <CardContent class="p-6 sm:p-8">
      <div
        class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
      >
        The Capability Gap
      </div>

      <div class="flex items-center justify-center gap-6 sm:gap-10">
        <!-- Verified -->
        <div class="text-center">
          <div
            class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            {{ verified }}
          </div>
          <div
            class="mt-1 max-w-[100px] text-[10px] leading-tight tracking-widest text-muted-foreground uppercase"
          >
            SWE-bench Verified
          </div>
          <div class="mt-0.5 text-[9px] text-muted-foreground/60">
            Curated bugs
          </div>
        </div>

        <!-- Gap indicator -->
        <div class="flex flex-col items-center gap-1">
          <div
            class="h-8 w-px bg-gradient-to-b from-foreground/20 via-orange-500/40 to-orange-500/20"
          />
          <span
            data-testid="gap-indicator"
            class="text-[10px] font-medium tracking-wider text-orange-500/60 uppercase"
            >gap</span
          >
          <div
            class="h-8 w-px bg-gradient-to-b from-orange-500/20 via-orange-500/40 to-foreground/20"
          />
        </div>

        <!-- Pro -->
        <div class="text-center">
          <div
            class="text-3xl font-semibold tracking-tight text-orange-500 sm:text-4xl"
          >
            {{ pro }}
          </div>
          <div
            class="mt-1 max-w-[100px] text-[10px] leading-tight tracking-widest text-muted-foreground uppercase"
          >
            SWE-bench Pro
          </div>
          <div class="mt-0.5 text-[9px] text-muted-foreground/60">
            Private codebases
          </div>
        </div>
      </div>

      <p class="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        Best AI scores on curated open-source vs. private real-world code. The
        gap is the story.
      </p>

      <p
        v-if="note"
        data-testid="capability-gap-note"
        class="mt-3 rounded-lg bg-orange-500/5 px-3 py-2 text-center text-xs leading-relaxed text-orange-400/80"
      >
        {{ note }}
      </p>
    </CardContent>
  </Card>
</template>
