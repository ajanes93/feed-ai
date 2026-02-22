<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@feed-ai/shared/components/ui/button";
import { Input } from "@feed-ai/shared/components/ui/input";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";

defineProps<{
  status: "idle" | "loading" | "success" | "error";
}>();

const emit = defineEmits<{
  subscribe: [email: string];
}>();

const email = ref("");

function onSubmit() {
  const trimmed = email.value.trim();
  if (trimmed && trimmed.includes("@")) {
    emit("subscribe", trimmed);
  }
}
</script>

<template>
  <Card class="relative overflow-hidden border-border bg-card py-0 text-center">
    <!-- Bottom accent line -->
    <div
      class="absolute right-0 bottom-0 left-0 h-px"
      style="
        background: linear-gradient(
          90deg,
          transparent,
          rgb(240 94 35),
          transparent
        );
        opacity: 0.3;
      "
    />

    <CardContent class="p-8 sm:p-12">
      <h3 class="font-serif text-2xl font-normal text-foreground sm:text-3xl">
        Get the daily take
      </h3>
      <p class="mt-2 text-sm text-muted-foreground">
        One email. One score. One AI opinion. Every morning.
      </p>

      <form
        v-if="status !== 'success'"
        class="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row"
        @submit.prevent="onSubmit"
      >
        <Input
          v-model="email"
          type="email"
          placeholder="your@email.com"
          class="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:ring-orange-500"
          :disabled="status === 'loading'"
        />
        <Button
          type="submit"
          class="bg-orange-500 text-white hover:bg-orange-600"
          :disabled="status === 'loading'"
        >
          {{ status === "loading" ? "Subscribing..." : "Subscribe" }}
        </Button>
      </form>

      <div v-else class="mt-6 text-sm text-emerald-400">
        Subscribed — you'll hear from us soon.
      </div>

      <div v-if="status === 'error'" class="mt-3 text-sm text-destructive">
        Something went wrong. Please try again.
      </div>
    </CardContent>
  </Card>
</template>
