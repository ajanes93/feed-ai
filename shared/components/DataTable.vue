<script setup lang="ts">
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";

defineProps<{
  columns: { key: string; label: string }[];
  rowCount: number;
  emptyMessage?: string;
}>();
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border bg-card/50">
    <Table>
      <TableHeader>
        <TableRow class="border-border/50 hover:bg-transparent">
          <TableHead
            v-for="col in columns"
            :key="col.key"
            class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            {{ col.label }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody v-auto-animate="{ duration: 150 }">
        <slot v-if="rowCount > 0" />
        <TableRow
          v-else
          class="hover:bg-transparent"
        >
          <TableCell
            :colspan="columns.length"
            class="py-8 text-center text-muted-foreground"
          >
            {{ emptyMessage || "No data" }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
