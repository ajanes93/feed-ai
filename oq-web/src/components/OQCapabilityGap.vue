<script setup lang="ts">
import { ref } from "vue";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@feed-ai/shared/components/ui/collapsible";
import { ExternalLink, ChevronDown } from "lucide-vue-next";
import OQExplainer from "./OQExplainer.vue";

defineProps<{
  verified: string;
  pro: string;
  verifiedSource?: string;
  proSource?: string;
  proPrivate?: string;
  proPrivateSource?: string;
  note?: string;
}>();

const isOpen = ref(false);
</script>

<template>
  <Card class="border-border bg-card py-0">
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
            class="mt-1 flex max-w-[120px] items-center justify-center gap-1 text-[10px] leading-tight tracking-widest text-muted-foreground uppercase"
          >
            SWE-bench Verified
            <OQExplainer
              text="AI agents fix real bugs from 12 popular open-source Python repos. 'Verified' = human-reviewed test cases. Run by Princeton's SWE-bench team."
            />
          </div>
          <div class="mt-0.5 text-[9px] text-muted-foreground/60">
            Curated open-source bugs AI may have memorised
          </div>
          <a
            v-if="verifiedSource"
            :href="verifiedSource"
            target="_blank"
            rel="noopener"
            class="mt-1 inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/40 transition-colors hover:text-orange-500/60"
          >
            swebench.com
            <ExternalLink class="h-2 w-2" />
          </a>
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
            class="mt-1 flex max-w-[120px] items-center justify-center gap-1 text-[10px] leading-tight tracking-widest text-muted-foreground uppercase"
          >
            SWE-bench Pro
            <OQExplainer
              text="Harder benchmark using repos AI hasn't seen in training. GPL licences deter training inclusion. Run by Scale AI, separate from SWE-bench team."
            />
          </div>
          <div class="mt-0.5 text-[9px] text-muted-foreground/60">
            Unfamiliar real-world repos AI hasn't seen in training
          </div>
          <a
            v-if="proSource"
            :href="proSource"
            target="_blank"
            rel="noopener"
            class="mt-1 inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/40 transition-colors hover:text-orange-500/60"
          >
            Scale AI SEAL
            <ExternalLink class="h-2 w-2" />
          </a>
        </div>
      </div>

      <p class="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        AI solves 3 in 4 practiced problems. Less than 1 in 2 on code it hasn't
        seen before.
      </p>

      <p
        v-if="note"
        data-testid="capability-gap-note"
        class="mt-3 rounded-lg bg-orange-500/5 px-3 py-2 text-center text-xs leading-relaxed text-orange-400/80"
      >
        {{ note }}
      </p>

      <!-- Drill-down -->
      <Collapsible v-model:open="isOpen" class="mt-4">
        <CollapsibleTrigger
          class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] tracking-widest text-muted-foreground/60 uppercase transition-colors hover:text-muted-foreground"
        >
          <span>Drill down: Private codebases</span>
          <ChevronDown
            class="h-3 w-3 transition-transform duration-200"
            :class="{ 'rotate-180': isOpen }"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            class="mt-3 space-y-3 rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground"
          >
            <p v-if="proPrivate">
              On truly private code (startup codebases AI can never have seen):
              top score drops to
              <span class="font-semibold text-orange-400">{{ proPrivate }}</span
              >.
              <a
                v-if="proPrivateSource"
                :href="proPrivateSource"
                target="_blank"
                rel="noopener"
                class="ml-1 inline-flex items-center gap-0.5 text-muted-foreground/50 transition-colors hover:text-orange-500/60"
              >
                Source: Scale AI SEAL Private
                <ExternalLink class="h-2 w-2" />
              </a>
            </p>

            <div>
              <p class="mb-1 text-[10px] tracking-widest uppercase">Note</p>
              <p>
                SWE-bench (Princeton) and SWE-bench Pro (Scale AI) are separate
                benchmarks with different datasets and evaluation methods. High
                Verified scores don't predict Pro performance.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  </Card>
</template>
