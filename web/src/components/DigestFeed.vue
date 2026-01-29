<script setup lang="ts">
import type { DigestItem } from '../types';
import DigestCard from './DigestCard.vue';

defineProps<{
  items: DigestItem[];
}>();
</script>

<template>
  <div class="h-screen overflow-y-scroll snap-y snap-mandatory">
    <DigestCard
      v-for="item in items"
      :key="item.id"
      :item="item"
    />
  </div>
</template>
