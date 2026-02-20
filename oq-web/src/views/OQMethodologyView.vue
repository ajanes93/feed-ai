<script setup lang="ts">
import { onMounted } from "vue";
import { useOneQuestion } from "../composables/useOneQuestion";

const { methodology, fetchMethodology } = useOneQuestion();

onMounted(() => fetchMethodology());
</script>

<template>
  <div class="h-[100dvh] overflow-y-auto bg-gray-950 text-gray-100">
    <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <router-link
          to="/"
          class="font-serif text-lg tracking-tight text-gray-500"
        >
          one<span class="text-orange-500">?</span>
        </router-link>
        <router-link to="/" class="text-xs text-gray-500 hover:text-orange-500">
          Back to score
        </router-link>
      </header>

      <h1 class="mt-12 font-serif text-3xl tracking-tight sm:text-4xl">
        Methodology
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-gray-500">
        How the replacement likelihood score is calculated, what data it uses,
        and the calibration rules that keep it honest.
      </p>

      <!-- Loading -->
      <div v-if="!methodology" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-orange-500"
        />
      </div>

      <template v-else>
        <!-- Scoring Pillars -->
        <section class="mt-10">
          <h2 class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
            Scoring Pillars
          </h2>
          <div class="space-y-3">
            <div
              v-for="pillar in methodology.pillars"
              :key="pillar.key"
              class="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-5 py-3"
            >
              <span class="text-sm text-gray-300">{{ pillar.name }}</span>
              <span class="font-mono text-xs text-orange-500">
                {{ (pillar.weight * 100).toFixed(0) }}%
              </span>
            </div>
          </div>
        </section>

        <!-- Formula -->
        <section class="mt-10">
          <h2 class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
            Consensus Formula
          </h2>
          <div
            class="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm leading-relaxed text-gray-400"
          >
            <div class="mb-3">
              <span class="text-[10px] tracking-widest text-gray-600 uppercase">
                Models
              </span>
              <ul class="mt-1 space-y-1">
                <li
                  v-for="(model, i) in methodology.formula.models"
                  :key="i"
                  class="flex items-center gap-2"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-orange-500/50" />
                  {{ model }}
                </li>
              </ul>
            </div>
            <div class="grid grid-cols-2 gap-3 border-t border-gray-800 pt-3">
              <div>
                <div class="text-[10px] text-gray-600">Dampening</div>
                <div class="font-mono text-gray-300">
                  {{ methodology.formula.dampening }}x
                </div>
              </div>
              <div>
                <div class="text-[10px] text-gray-600">Daily Cap</div>
                <div class="font-mono text-gray-300">
                  &plusmn;{{ methodology.formula.dailyCap }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-gray-600">Score Range</div>
                <div class="font-mono text-gray-300">
                  {{ methodology.formula.scoreRange[0] }}&ndash;{{
                    methodology.formula.scoreRange[1]
                  }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-gray-600">Decay Target</div>
                <div class="font-mono text-gray-300">
                  {{ methodology.formula.decayTarget }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Capability Gap -->
        <section class="mt-10">
          <h2 class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
            The Capability Gap
          </h2>
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div class="flex items-center gap-6">
              <div class="text-center">
                <div class="text-2xl font-semibold text-gray-200">
                  {{ methodology.capabilityGap.verified }}
                </div>
                <div class="mt-1 text-[10px] text-gray-600">
                  SWE-bench Verified
                </div>
              </div>
              <div class="text-lg text-gray-700">vs</div>
              <div class="text-center">
                <div class="text-2xl font-semibold text-orange-500">
                  {{ methodology.capabilityGap.pro }}
                </div>
                <div class="mt-1 text-[10px] text-gray-600">SWE-bench Pro</div>
              </div>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-gray-500">
              {{ methodology.capabilityGap.description }}
            </p>
          </div>
        </section>

        <!-- What Would Change -->
        <section class="mt-10">
          <h2 class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
            What Would Move This Score
          </h2>

          <div class="space-y-5">
            <div
              v-for="(items, label) in {
                'To 50+': methodology.whatWouldChange.to50,
                'To 70+': methodology.whatWouldChange.to70,
                'Below 20': methodology.whatWouldChange.below20,
              }"
              :key="label"
              class="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div
                class="mb-3 text-xs font-semibold"
                :class="{
                  'text-yellow-500': label === 'To 50+',
                  'text-red-400': label === 'To 70+',
                  'text-emerald-400': label === 'Below 20',
                }"
              >
                {{ label }}
              </div>
              <ul class="space-y-2">
                <li
                  v-for="(item, i) in items"
                  :key="i"
                  class="flex items-start gap-2 text-sm leading-relaxed text-gray-400"
                >
                  <span
                    class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-700"
                  />
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Prompt Hash -->
        <section class="mt-10 pb-16">
          <div class="text-[10px] tracking-widest text-gray-600 uppercase">
            Current Prompt Hash
          </div>
          <div class="mt-1 font-mono text-xs text-gray-500">
            {{ methodology.currentPromptHash }}
          </div>
          <p class="mt-2 text-xs text-gray-600">
            Every prompt version is hashed and stored. If the scoring
            methodology changes, the hash changes — full auditability.
          </p>
        </section>
      </template>

      <!-- Footer -->
      <footer
        class="border-t border-gray-800 py-6 text-center text-xs text-gray-600"
      >
        <router-link to="/" class="text-gray-500 hover:text-orange-500">
          Back to score
        </router-link>
      </footer>
    </div>
  </div>
</template>
