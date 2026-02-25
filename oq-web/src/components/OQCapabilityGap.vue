<script setup lang="ts">
import { ref, computed } from "vue";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@feed-ai/shared/components/ui/collapsible";
import { ExternalLink, ChevronDown } from "lucide-vue-next";
import OQExplainer from "./OQExplainer.vue";

const props = defineProps<{
  verified: string;
  pro: string;
  verifiedSource?: string;
  proSource?: string;
  proPrivate?: string;
  proPrivateSource?: string;
  note?: string;
  lastUpdated?: string;
  verifiedDelta?: number;
  proDelta?: number;
  proPrivateDelta?: number;
  previousDate?: string;
}>();

function formatDelta(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}

function deltaColor(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "";
  return delta > 0 ? "text-emerald-400" : "text-red-400";
}

function formatUpdatedDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

const isOpen = ref(false);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toFraction(pctStr: string): string {
  const n = parseFloat(pctStr.replace("~", "").replace("%", ""));
  if (isNaN(n)) return "unknown";
  if (n >= 75) return "3 in 4";
  if (n >= 66) return "2 in 3";
  if (n >= 50) return "1 in 2";
  if (n >= 25) return "less than 1 in 2";
  return "less than 1 in 4";
}

const proPrivateDisplay = computed(() => props.proPrivate ?? "~23%");

const gapText = computed(() => {
  const proFrac = toFraction(props.pro);
  const privateFrac = props.proPrivate ? toFraction(props.proPrivate) : null;
  if (privateFrac && privateFrac !== proFrac) {
    return `${capitalize(proFrac)} on unfamiliar code. ${capitalize(privateFrac)} on code AI has never seen.`;
  }
  return `AI solves ${proFrac} problems on unfamiliar codebases.`;
});
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
        <!-- Pro Public (primary) -->
        <div class="text-center">
          <div
            class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            {{ pro }}
            <span
              v-if="proDelta !== undefined && proDelta !== 0"
              class="ml-1 text-sm font-normal"
              :class="deltaColor(proDelta)"
            >
              {{ formatDelta(proDelta) }}
            </span>
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
            Public GPL repos
          </div>
          <a
            v-if="proSource"
            :href="proSource"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/40 transition-colors hover:text-orange-500/60"
          >
            Scale AI SEAL
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

        <!-- Pro Private -->
        <div class="text-center">
          <div
            class="text-3xl font-semibold tracking-tight text-orange-500 sm:text-4xl"
          >
            {{ proPrivateDisplay }}
            <span
              v-if="proPrivateDelta !== undefined && proPrivateDelta !== 0"
              class="ml-1 text-sm font-normal"
              :class="deltaColor(proPrivateDelta)"
            >
              {{ formatDelta(proPrivateDelta) }}
            </span>
          </div>
          <div
            class="mt-1 flex max-w-[120px] items-center justify-center gap-1 text-[10px] leading-tight tracking-widest text-muted-foreground uppercase"
          >
            Pro Private
            <OQExplainer
              text="Proprietary startup codebases AI has never seen. The most honest measure of real-world coding ability. Run by Scale AI SEAL."
            />
          </div>
          <div class="mt-0.5 text-[9px] text-muted-foreground/60">
            Proprietary startup code
          </div>
          <a
            v-if="proPrivateSource"
            :href="proPrivateSource"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/40 transition-colors hover:text-orange-500/60"
          >
            Scale AI SEAL
            <ExternalLink class="h-2 w-2" />
          </a>
        </div>
      </div>

      <p class="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        {{ gapText }}
      </p>

      <!-- Deprecated Verified footnote -->
      <p
        class="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground/50"
      >
        Previously: {{ verified }} on SWE-bench Verified — deprecated Feb 23
        (contamination confirmed).
        <a
          href="https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-0.5 text-muted-foreground/40 transition-colors hover:text-orange-500/60"
        >
          OpenAI post
          <ExternalLink class="h-2 w-2" />
        </a>
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
          <span>Drill down</span>
          <ChevronDown
            class="h-3 w-3 transition-transform duration-200"
            :class="{ 'rotate-180': isOpen }"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            class="mt-3 space-y-3 rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground"
          >
            <div>
              <p class="mb-1 text-[10px] tracking-widest uppercase">
                Why was SWE-bench Verified deprecated?
              </p>
              <p>
                On Feb 23, OpenAI confirmed that models had memorised SWE-bench
                Verified solutions. The 79% score was partly recall, not coding
                ability. 59.4% of hard tasks have broken tests that reject
                correct solutions.
                <a
                  href="https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 inline-flex items-center gap-0.5 text-muted-foreground/50 transition-colors hover:text-orange-500/60"
                >
                  OpenAI post
                  <ExternalLink class="h-2 w-2" />
                </a>
              </p>
            </div>

            <div>
              <p class="mb-1 text-[10px] tracking-widest uppercase">
                Are Pro benchmarks reliable?
              </p>
              <p>
                LessWrong audit (Feb 24) found SWE-bench Pro also has issues —
                test leniency and requirements inflation. No benchmark is
                perfect, which is why this site tracks multiple independent
                sources (SWE-bench Pro, SanityHarness, FRED labour data).
              </p>
            </div>

            <div>
              <p class="mb-1 text-[10px] tracking-widest uppercase">Note</p>
              <p>
                SWE-bench Pro Public ({{ pro }}) uses GPL repos AI is unlikely
                to have trained on. Pro Private ({{ proPrivateDisplay }}) uses
                truly proprietary startup code. The gap between these numbers
                reveals how much benchmark scores depend on data familiarity.
              </p>
            </div>

            <div class="flex items-center gap-3 text-[9px]">
              <a
                v-if="proSource"
                :href="proSource"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-muted-foreground/50 transition-colors hover:text-orange-500/60"
              >
                Source: Scale AI SEAL<span v-if="lastUpdated" class="ml-0.5"
                  >· Updated {{ formatUpdatedDate(lastUpdated) }}</span
                >
                <ExternalLink class="h-2 w-2" />
              </a>
              <a
                v-if="verifiedSource"
                :href="verifiedSource"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-muted-foreground/50 transition-colors hover:text-orange-500/60"
              >
                swebench.com (deprecated)
                <ExternalLink class="h-2 w-2" />
              </a>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </CardContent>
  </Card>
</template>
