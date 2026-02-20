# One Question — Gap Fill Plan

Eleven items to bring the implementation in line with the plan. Ordered by implementation sequence.

---

## 1. OG meta tags (static)

**Problem:** `oq-web/index.html` has no OG tags. Critical for Show HN launch and social sharing.

**Changes to `oq-web/index.html`:**
- `og:title` — "Will AI Replace Software Engineers? Today: 32%"
- `og:description` — "Three AI models read the signals daily. SWE-bench Pro: 23%. The gap is the story."
- `og:type` — "website"
- `twitter:card` — "summary_large_image"
- Standard `<meta name="description">` tag

Static values as a baseline — gap 2 makes them dynamic.

---

## 2. Dynamic OG tags via HTMLRewriter

**Problem:** Static OG tags show a hardcoded score. Cloudflare Workers has `HTMLRewriter` built in — we can inject today's actual score into the meta tags on each request.

**Changes:**
- In the Worker that serves the SPA (`oq-worker` or a Pages `_worker.js`), add an `HTMLRewriter` pass on HTML responses
- Rewrite `og:title` content to include today's score from D1 (e.g. "Will AI Replace Software Engineers? Today: 34%")
- Rewrite `og:description` to include the day's analysis snippet
- Cache the D1 lookup (score changes once/day) so this adds negligible latency

---

## 3. "What Would Move This Score?" section on the public page

**Problem:** The data exists in `/api/methodology` but nothing renders it on the public page. The plan says this should be "displayed prominently" as a signal of intellectual honesty.

**Changes:**
- Create `oq-web/src/components/OQWhatWouldChange.vue` — three sections (To 50+, To 70+, Below 20) showing the scenario bullets from methodology
- Add `fetchMethodology()` to `useOneQuestion.ts` composable
- Add the component to `OneQuestionView.vue` between the trend chart and subscribe sections

---

## 4. Methodology page

**Problem:** The `/api/methodology` endpoint exists but there's no rendered page. The plan calls for a dedicated methodology page explaining the scoring system, sources, and calibration rules.

**Changes:**
- Create `oq-web/src/views/OQMethodologyView.vue`:
  - Fetch from `/api/methodology`
  - Render: scoring pillars with weights, source list, calibration rules, "What Would Move" scenarios
  - Same dark theme styling as the main page
- Add route `/methodology` to the Vue router
- Add a link to methodology from the main page footer or header

---

## 5. Capability Gap as a structured headline component

**Problem:** Currently renders as a plain text paragraph. The plan envisions this as *the* headline metric — "Verified 80% vs Pro 23%" — with visual weight.

**Changes:**
- Create `oq-web/src/components/OQCapabilityGap.vue`:
  - Two numbers (Verified %, Pro %) side by side with large typography
  - Visual gap indicator between them
  - Explanatory note underneath
- Replace the plain text section in `OneQuestionView.vue` with this component

---

## 6. Narrative model disagreement quotes

**Problem:** When models disagree, the plan says to quote them like a panel of experts — e.g. *"GPT-4 upgraded the score citing X, but Claude downgraded it, pointing to Y."* Currently `synthesizeAnalysis()` concatenates raw analyses with " — Meanwhile, " which reads poorly.

**Changes to `oq-worker/src/services/scorer.ts`:**
- Update `synthesizeAnalysis()` for `agreement === "disagree"`:
  - Extract model name, delta direction (upgraded/downgraded/held steady), first sentence of analysis
  - Build: *"Claude upgraded the score (+0.8), citing [first sentence]. GPT-4 disagreed (-1.2), pointing to [first sentence]."*
- The narrative flows through `today.analysis` — no frontend changes needed beyond what's already rendering

---

## 7. SanityHarness integration (Pillar 1)

**Problem:** The plan includes SanityHarness (sanityboard.lr7.dev) as a Pillar 1 data source. It benchmarks AI coding *agents* (not just models) across 6 languages, measuring the full agent loop. Closer to "can AI do the job" than SWE-bench.

**Changes:**

### 7a. Scraper service (`oq-worker/src/services/sanity-harness.ts`)
- Fetch the leaderboard page (static HTML)
- Extract top 10 rows: agent name, model, overall pass rate, per-language breakdown
- Calculate: top pass rate, median pass rate, language spread
- Return structured data

### 7b. Store as synthetic article
- On the weekly cron (or a separate weekly trigger), run the scraper
- Insert into `oq_articles` as a Pillar 1 synthetic article with a structured summary containing the key metrics
- Deduplicate by date (one entry per week)

### 7c. Update the scoring prompt (`oq-worker/src/services/prompt.ts`)
- Add SanityHarness context to the Pillar 1 section:
  ```
  SanityHarness latest data (agent-level benchmarks across 6 languages):
  - Top agent pass rate: {top_pass_rate}% ({top_agent_name} + {top_model})
  - Median agent pass rate: {median_pass_rate}%
  - Language spread (top agent): {language_breakdown}
  - Note: High pass rates on Go/Rust but low on Dart/Zig indicates
    narrow competence, not general replacement capability.
  ```
- Add optional `sanityHarness` field to `PromptContext`

### 7d. Update "What Would Move" scenarios
- Add to methodology endpoint and WhatWouldChange component:
  - **Up:** Top agent >85% AND all languages >60%
  - **Up significantly:** Median agent >70%
  - **Down:** Top agent plateaus or regresses

### 7e. Add admin endpoint
- `POST /api/fetch-sanity` (admin-only) to trigger manual scrape
- Also integrate into the existing cron (weekly check, e.g. Sundays)

---

## 8. SWE-bench leaderboard scraping (Pillar 1)

**Problem:** SWE-bench Verified vs Pro is *the* central capability gap metric in the prompt, but the values are currently hardcoded. We should scrape the leaderboard to keep them current.

**Changes:**

### 8a. Scraper service (`oq-worker/src/services/swe-bench.ts`)
- Fetch the SWE-bench leaderboard page
- Extract top scores for both Verified and Pro tracks
- Return: top Verified %, top Pro %, top model names, date

### 8b. Store + inject into prompt
- Store latest values in D1 (a simple key-value row or a dedicated table)
- On each scoring run, inject current Verified/Pro numbers into the prompt instead of hardcoded "~80%" / "~23%"
- Update the Capability Gap section of the prompt dynamically

### 8c. Feed into the Capability Gap component (gap 5)
- Pass real Verified/Pro numbers to the frontend instead of relying on free-text `capabilityGap` strings

### 8d. Admin endpoint
- `POST /api/fetch-swebench` (admin-only) to trigger manual scrape
- Also integrate into cron (weekly)

---

## 9. FRED API integration (Pillar 2)

**Problem:** The plan has `{software_index}` and `{general_index}` placeholders for labour market normalization. Without real data, models can't judge if software job declines are AI-specific or macro.

**Two phases:**

### Phase 1 — Prompt placeholders + manual input (now)
- Add `softwareIndex` and `generalIndex` optional fields to `PromptContext` in `prompt.ts`
- Update Pillar 2 prompt section: *"Software job postings index: {value}. General job postings index: {value}."* — falls back to "Data not currently available" if absent
- Add admin endpoint `POST /api/labour-indices` to manually set values

### Phase 2 — FRED API (once API key is approved)
- Create `oq-worker/src/services/fred.ts`:
  - Fetch IHLIDXUSTPSOFTDEVE (Indeed Software Dev Postings) series
  - Fetch ICSA (Initial Claims) or similar general employment series
  - Parse JSON response, extract latest value
- Run on weekly cron alongside SanityHarness
- Auto-populate the prompt context with real values

---

## 10. Seed historical data script

**Problem:** The trend chart requires `history.length > 1` to render. On launch day there's only a single-day seed fallback — the chart is empty.

**Changes:**
- Create `oq-worker/scripts/seed-history.ts`:
  - Insert 7 rows into `oq_scores` backdated from launch date
  - Score path: 28 → 29 → 29 → 30 → 31 → 31 → 32
  - `modelAgreement: "partial"`, `promptHash: "seed"`
  - Analysis: "Seed data — live tracking begins [date]"
- Run via `npx wrangler d1 execute` one time before launch

---

## 11. Favicon

**Problem:** No favicon set. Minor but noticeable.

**Changes:**
- Add a simple orange "?" favicon (SVG inline in `index.html` or a small .ico file)
- Add `<link rel="icon">` to `index.html`

---

## Implementation order

1. OG meta tags — static (5 min)
2. Dynamic OG tags — HTMLRewriter (30 min)
3. What Would Move This Score component (30 min)
4. Methodology page (30 min)
5. Capability Gap structured component (30 min)
6. Narrative model disagreement (20 min)
7. SanityHarness scraper + prompt + admin endpoint (1 hr)
8. SWE-bench scraper + prompt integration (45 min)
9. FRED Phase 1 — prompt placeholders + manual endpoint (15 min)
10. Seed history script (15 min)
11. Favicon (5 min)

Then: run lint, format, tests, commit, push.
