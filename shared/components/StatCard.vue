<script setup lang="ts">
import { motion } from "motion-v";
import { Card, CardContent } from "./ui/card";

defineProps<{
  value: string | number;
  label: string;
  highlight?: boolean;
  highlightClass?: string;
  index?: number;
}>();
</script>

<template>
  <motion.div
    :initial="{ opacity: 0, y: 12 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.35, delay: (index ?? 0) * 0.05 }"
  >
    <Card class="gap-0 py-0">
      <CardContent class="p-5">
        <div
          class="text-2xl font-bold tracking-tight"
          :class="
            highlight
              ? highlightClass || 'text-amber-400'
              : 'text-card-foreground'
          "
        >
          {{ value }}
        </div>
        <div class="mt-1 text-xs text-muted-foreground">{{ label }}</div>
      </CardContent>
    </Card>
  </motion.div>
</template>
