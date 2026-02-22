<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui";
import { CollapsibleContent, useForwardProps } from "reka-ui";

const props = defineProps<CollapsibleContentProps>();
const forwarded = useForwardProps(props);
</script>

<template>
  <CollapsibleContent
    data-slot="collapsible-content"
    class="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
    v-bind="forwarded"
  >
    <slot />
  </CollapsibleContent>
</template>
