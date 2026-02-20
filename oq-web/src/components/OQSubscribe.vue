<script setup lang="ts">
import { ref } from "vue";

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
  <div
    class="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12"
  >
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

    <h3 class="font-serif text-2xl font-normal sm:text-3xl">
      Get the daily take
    </h3>
    <p class="mt-2 text-sm text-gray-500">
      One email. One score. One AI opinion. Every morning.
    </p>

    <form
      v-if="status !== 'success'"
      class="mx-auto mt-6 flex max-w-sm flex-col gap-2 sm:flex-row"
      @submit.prevent="onSubmit"
    >
      <input
        v-model="email"
        type="email"
        placeholder="your@email.com"
        class="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-600 transition-colors outline-none focus:border-orange-500"
        :disabled="status === 'loading'"
      />
      <button
        type="submit"
        class="rounded-xl bg-orange-500 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-orange-600 disabled:opacity-50"
        :disabled="status === 'loading'"
      >
        {{ status === "loading" ? "Subscribing..." : "Subscribe" }}
      </button>
    </form>

    <div v-else class="mt-6 text-sm text-emerald-400">
      Subscribed — you'll hear from us soon.
    </div>

    <div v-if="status === 'error'" class="mt-3 text-sm text-red-400">
      Something went wrong. Please try again.
    </div>
  </div>
</template>
