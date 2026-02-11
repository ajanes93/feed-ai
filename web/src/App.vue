<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AiFab from "./components/AiFab.vue";

const route = useRoute();
const showFab = computed(
  () => route.path !== "/ai" && route.path !== "/dashboard"
);
</script>

<template>
  <router-view />
  <AiFab v-if="showFab" />
</template>
