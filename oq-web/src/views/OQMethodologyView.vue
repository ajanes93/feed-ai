<script setup lang="ts">
import { onMounted } from "vue";
import { useHead } from "@unhead/vue";
import { useOneQuestion } from "../composables/useOneQuestion";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import { Badge } from "@feed-ai/shared/components/ui/badge";
import { Separator } from "@feed-ai/shared/components/ui/separator";

const { methodology, fetchMethodology } = useOneQuestion();

useHead({ title: "Methodology — One Question" });

onMounted(() => fetchMethodology());
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
        Methodology
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
        How the replacement likelihood score is calculated, what data it uses,
        and the calibration rules that keep it honest.
      </p>

      <!-- Loading -->
      <div v-if="!methodology" class="flex justify-center py-20">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-orange-500"
        />
      </div>

      <template v-else>
        <!-- Scoring Pillars -->
        <section class="mt-10">
          <h2
            class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
          >
            Scoring Pillars
          </h2>
          <div class="space-y-3">
            <Card
              v-for="pillar in methodology.pillars"
              :key="pillar.key"
              class="border-border bg-card py-0"
            >
              <CardContent class="flex items-center justify-between px-5 py-3">
                <span class="text-sm text-foreground/80">{{
                  pillar.name
                }}</span>
                <Badge
                  variant="outline"
                  class="font-mono text-xs text-orange-500"
                >
                  {{ (pillar.weight * 100).toFixed(0) }}%
                </Badge>
              </CardContent>
            </Card>
          </div>
        </section>

        <!-- Formula -->
        <section class="mt-10">
          <h2
            class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
          >
            Consensus Formula
          </h2>
          <Card class="border-border bg-card py-0">
            <CardContent
              class="p-5 text-sm leading-relaxed text-muted-foreground"
            >
              <div class="mb-3">
                <span
                  class="text-[10px] tracking-widest text-muted-foreground uppercase"
                >
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
              <Separator class="my-3 bg-border" />
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <div class="text-[10px] text-muted-foreground">Dampening</div>
                  <div class="font-mono text-foreground/80">
                    {{ methodology.formula.dampening }}x
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-muted-foreground">Daily Cap</div>
                  <div class="font-mono text-foreground/80">
                    &plusmn;{{ methodology.formula.dailyCap }}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-muted-foreground">
                    Score Range
                  </div>
                  <div class="font-mono text-foreground/80">
                    {{ methodology.formula.scoreRange[0] }}&ndash;{{
                      methodology.formula.scoreRange[1]
                    }}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-muted-foreground">
                    Decay Target
                  </div>
                  <div class="font-mono text-foreground/80">
                    {{ methodology.formula.decayTarget }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <!-- Capability Gap -->
        <section class="mt-10">
          <h2
            class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
          >
            The Capability Gap
          </h2>
          <Card class="border-border bg-card py-0">
            <CardContent class="p-5">
              <div class="flex items-center gap-6">
                <div class="text-center">
                  <div class="text-2xl font-semibold text-foreground">
                    {{ methodology.capabilityGap.verified }}
                  </div>
                  <div class="mt-1 text-[10px] text-muted-foreground">
                    SWE-bench Verified
                  </div>
                </div>
                <div class="text-lg text-border">vs</div>
                <div class="text-center">
                  <div class="text-2xl font-semibold text-orange-500">
                    {{ methodology.capabilityGap.pro }}
                  </div>
                  <div class="mt-1 text-[10px] text-muted-foreground">
                    SWE-bench Pro
                  </div>
                </div>
              </div>
              <p class="mt-4 text-sm leading-relaxed text-muted-foreground">
                {{ methodology.capabilityGap.description }}
              </p>
            </CardContent>
          </Card>
        </section>

        <!-- What Would Change -->
        <section class="mt-10">
          <h2
            class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
          >
            What Would Move This Score
          </h2>

          <div class="space-y-5">
            <Card
              v-for="(items, label) in {
                'To 50+': methodology.whatWouldChange.to50,
                'To 70+': methodology.whatWouldChange.to70,
                'Below 20': methodology.whatWouldChange.below20,
              }"
              :key="label"
              class="border-border bg-card py-0"
            >
              <CardContent class="p-5">
                <Badge
                  :variant="
                    label === 'To 50+'
                      ? 'warning'
                      : label === 'To 70+'
                        ? 'error'
                        : 'success'
                  "
                  class="mb-3 text-xs font-semibold"
                >
                  {{ label }}
                </Badge>
                <ul class="space-y-2">
                  <li
                    v-for="(item, i) in items"
                    :key="i"
                    class="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span
                      class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-border"
                    />
                    {{ item }}
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <!-- Prompt Hash -->
        <section class="mt-10 pb-16">
          <div
            class="text-[10px] tracking-widest text-muted-foreground uppercase"
          >
            Current Prompt Hash
          </div>
          <div class="mt-1 font-mono text-xs text-muted-foreground">
            {{ methodology.currentPromptHash }}
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            Every prompt version is hashed and stored. If the scoring
            methodology changes, the hash changes — full auditability.
          </p>
        </section>
      </template>

      <!-- Footer -->
      <footer
        class="border-t border-border py-6 text-center text-xs text-muted-foreground"
      >
        <router-link to="/" class="text-muted-foreground hover:text-orange-500">
          Back to score
        </router-link>
      </footer>
    </div>
  </div>
</template>
