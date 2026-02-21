<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { ChevronDown } from "lucide-vue-next";

defineProps<{
  label: string;
  disabled?: boolean;
}>();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        :disabled="disabled"
      >
        {{ label }}
        <ChevronDown class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <slot :close="() => {}" />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
