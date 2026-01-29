<script setup lang="ts">
import { onMounted } from "vue";
import { useDigest } from "./composables/useDigest";
import DigestFeed from "./components/DigestFeed.vue";
import DateHeader from "./components/DateHeader.vue";
import EmptyState from "./components/EmptyState.vue";

const { digest, loading, error, formattedDate, fetchToday } = useDigest();

onMounted(() => {
  fetchToday();
});
</script>

<template>
  <div class="min-h-screen bg-gray-900">
    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex h-screen items-center justify-center"
    >
      <div class="text-gray-400">Loading...</div>
    </div>

    <!-- Error/Empty state -->
    <EmptyState
      v-else-if="error"
      :message="error"
    />

    <!-- Digest content -->
    <template v-else-if="digest">
      <DateHeader
        :date="formattedDate"
        :item-count="digest.itemCount"
      />
      <DigestFeed :items="digest.items" />
    </template>
  </div>
</template>
