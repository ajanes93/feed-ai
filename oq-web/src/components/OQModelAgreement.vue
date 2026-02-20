<script setup lang="ts">
import type { OQModelScore, OQModelAgreement } from "@feed-ai/shared/oq-types";
import { formatModelName } from "@feed-ai/shared/utils";

defineProps<{
  modelAgreement: OQModelAgreement;
  modelSpread: number;
  modelScores: OQModelScore[];
}>();
</script>

<template>
  <div class="rounded-xl border border-gray-800 bg-gray-800/30 p-4">
    <div class="mb-2 flex items-center gap-2 text-xs text-gray-500">
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
      <span class="ml-auto font-mono text-[10px] text-gray-600">
        spread: {{ modelSpread }}
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
        <span class="font-medium text-gray-400">
          {{ formatModelName(score.model) }}
        </span>
        <span class="font-mono text-gray-500">
          {{ score.suggested_delta > 0 ? "+" : ""
          }}{{ score.suggested_delta.toFixed(1) }}
        </span>
      </div>
    </div>
  </div>
</template>
