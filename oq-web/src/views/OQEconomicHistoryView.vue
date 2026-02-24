<script setup lang="ts">
import { useHead } from "@unhead/vue";
import OQEconomicHistory from "../components/OQEconomicHistory.vue";

useHead({ title: "Economic Trends — One Question" });
</script>

<template>
  <div class="h-[100dvh] overflow-y-auto bg-background text-foreground">
    <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <router-link
          to="/"
          class="font-serif text-lg tracking-tight text-muted-foreground"
        >
          one<span class="text-orange-500">?</span>
        </router-link>
        <router-link
          to="/"
          class="text-xs text-muted-foreground hover:text-orange-500"
        >
          Back to score
        </router-link>
      </header>

      <h1 class="mt-12 font-serif text-3xl tracking-tight sm:text-4xl">
        Economic Trends
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
        Historical Indeed Software Dev Postings Index overlaid with daily score
        changes. Track how labour market signals correlate with score movements.
      </p>

      <section class="mt-8">
        <OQEconomicHistory />
      </section>

      <!-- Footer -->
      <footer
        class="mt-12 border-t border-border py-6 text-center text-xs text-muted-foreground"
      >
        <router-link to="/" class="text-muted-foreground hover:text-orange-500">
          Back to score
        </router-link>
        ·
        <router-link
          to="/methodology"
          class="text-muted-foreground hover:text-orange-500"
        >
          Methodology
        </router-link>
      </footer>
    </div>
  </div>
</template>
