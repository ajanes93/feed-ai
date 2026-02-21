<script setup lang="ts">
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import { Badge } from "@feed-ai/shared/components/ui/badge";

const props = defineProps<{
  to50: string[];
  to70: string[];
  below20: string[];
}>();

const sections = [
  {
    label: "To 50+",
    desc: "What would move the score above 50%",
    variant: "warning" as const,
    items: () => props.to50,
  },
  {
    label: "To 70+",
    desc: "What would push toward likely replacement",
    variant: "error" as const,
    items: () => props.to70,
  },
  {
    label: "Below 20",
    desc: "What would push toward unlikely",
    variant: "success" as const,
    items: () => props.below20,
  },
];
</script>

<template>
  <Card class="border-border bg-card">
    <CardContent class="p-6 sm:p-8">
      <div
        class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
      >
        What Would Move This Score?
      </div>
      <p class="mb-6 text-xs leading-relaxed text-muted-foreground">
        Transparency matters. Here's exactly what would change the number.
      </p>

      <div class="space-y-6">
        <div v-for="section in sections" :key="section.label">
          <div class="mb-2 flex items-center gap-2">
            <Badge
              :variant="section.variant"
              class="text-[10px] font-semibold tracking-wide"
            >
              {{ section.label }}
            </Badge>
            <span class="text-xs text-muted-foreground">{{
              section.desc
            }}</span>
          </div>
          <ul class="space-y-1.5 pl-1">
            <li
              v-for="(item, i) in section.items()"
              :key="i"
              class="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
            >
              <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-border" />
              {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
