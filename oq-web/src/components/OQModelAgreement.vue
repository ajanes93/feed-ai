<script setup lang="ts">
import type { OQModelScore, OQModelAgreement } from "@feed-ai/shared/oq-types";
import { formatModelName } from "@feed-ai/shared/utils";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import OQExplainer from "./OQExplainer.vue";

defineProps<{
  modelAgreement: OQModelAgreement;
  modelSpread: number;
  modelScores: OQModelScore[];
}>();
</script>

<template>
  <Card class="border-border bg-secondary/30 py-0">
    <CardContent class="p-4">
      <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          class="inline-block h-2 w-2 rounded-full"
          :class="{
            'bg-emerald-500': modelAgreement === 'agree',
            'bg-yellow-500': modelAgreement === 'mostly_agree',
            'bg-red-500': modelAgreement === 'disagree',
            'bg-gray-500': modelAgreement === 'partial',
          }"
        />
        <span v-if="modelAgreement === 'agree'">Models agree</span>
        <span v-else-if="modelAgreement === 'mostly_agree'"
          >Models mostly agree</span
        >
        <span v-else-if="modelAgreement === 'disagree'">Models disagree</span>
        <span v-else>Partial consensus</span>
        <span
          class="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
        >
          spread: {{ modelSpread }}
          <OQExplainer
            text="How much the three AI models disagree. 0 = identical scores, 10 = maximum disagreement. Under 3 = broad consensus."
          />
        </span>
      </div>

      <!-- Show individual model scores when they disagree -->
      <div
        v-if="modelAgreement === 'disagree' || modelAgreement === 'partial'"
        class="mt-3 flex flex-col gap-2"
      >
        <div
          v-for="score in modelScores"
          :key="score.model"
          class="flex items-center justify-between text-xs"
        >
          <span class="font-medium text-muted-foreground">
            {{ formatModelName(score.model) }}
          </span>
          <Badge
            :variant="
              score.suggested_delta > 0
                ? 'error'
                : score.suggested_delta < 0
                  ? 'success'
                  : 'secondary'
            "
            class="font-mono text-[10px]"
          >
            {{ score.suggested_delta > 0 ? "+" : ""
            }}{{ score.suggested_delta.toFixed(1) }}
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
