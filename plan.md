# One Question — Gap Fill Plan

Seven items to bring the implementation in line with the plan. Ordered by implementation sequence.

---

## 1. OG meta tags

**Problem:** `oq-web/index.html` has no OG tags. Critical for Show HN launch and social sharing.

**Changes to `oq-web/index.html`:**
- `og:title` — "Will AI Replace Software Engineers? Today: 32%"
- `og:description` — "Three AI models read the signals daily. SWE-bench Pro: 23%. The gap is the story."
- `og:type` — "website"
- `twitter:card` — "summary_large_image"
- Standard `<meta name="description">` tag

Static values for v1. Dynamic OG tags (today's actual score) would require a Worker HTML rewriter — skip for now.

---

## 2. "What Would Move This Score?" section on the public page

**Problem:** The data exists in `/api/methodology` but nothing renders it on the public page. The plan says this should be "displayed prominently" as a signal of intellectual honesty.

**Changes:**
- Create `oq-web/src/components/OQWhatWouldChange.vue` — three sections (To 50+, To 70+, Below 20) showing the scenario bullets from methodology
- Add `fetchMethodology()` to `useOneQuestion.ts` composable
- Add the component to `OneQuestionView.vue` between the trend chart and subscribe sections

---

## 3. Capability Gap as a structured headline component

**Problem:** Currently renders as a plain text paragraph. The plan envisions this as *the* headline metric — "Verified 80% vs Pro 23%" — with visual weight.

**Changes:**
- Create `oq-web/src/components/OQCapabilityGap.vue`:
  - Two numbers (Verified %, Pro %) side by side with large typography
  - Visual gap indicator between them
  - Explanatory note underneath
- Replace the plain text section in `OneQuestionView.vue` with this component

---

## 4. Narrative model disagreement quotes

**Problem:** When models disagree, the plan says to quote them like a panel of experts — e.g. *"GPT-4 upgraded the score citing X, but Claude downgraded it, pointing to Y."* Currently `synthesizeAnalysis()` concatenates raw analyses with " — Meanwhile, " which reads poorly.

**Changes to `oq-worker/src/services/scorer.ts`:**
- Update `synthesizeAnalysis()` for `agreement === "disagree"`:
  - Extract model name, delta direction (upgraded/downgraded/held steady), first sentence of analysis
  - Build: *"Claude upgraded the score (+0.8), citing [first sentence]. GPT-4 disagreed (-1.2), pointing to [first sentence]."*
- The narrative flows through `today.analysis` — no frontend changes needed beyond what's already rendering

---

## 5. SanityHarness integration (Pillar 1)

**Problem:** The plan now includes SanityHarness (sanityboard.lr7.dev) as a Pillar 1 data source. It benchmarks AI coding *agents* (not just models) across 6 languages, measuring the full agent loop. This is closer to "can AI do the job" than SWE-bench.

**Changes:**

### 5a. Scraper service (`oq-worker/src/services/sanity-harness.ts`)
- Fetch the leaderboard page (static HTML)
- Extract top 10 rows: agent name, model, overall pass rate, per-language breakdown
- Calculate: top pass rate, median pass rate, language spread
- Return structured data

### 5b. Store as synthetic article
- On the weekly cron (or a separate weekly trigger), run the scraper
- Insert into `oq_articles` as a Pillar 1 synthetic article with a structured summary containing the key metrics
- Deduplicate by date (one entry per week)

### 5c. Update the scoring prompt (`oq-worker/src/services/prompt.ts`)
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

### 5d. Update "What Would Move" scenarios
- Add to methodology endpoint and WhatWouldChange component:
  - **Up:** Top agent >85% AND all languages >60%
  - **Up significantly:** Median agent >70%
  - **Down:** Top agent plateaus or regresses

### 5e. Add admin endpoint
- `POST /api/fetch-sanity` (admin-only) to trigger manual scrape
- Also integrate into the existing cron (weekly check, e.g. Sundays)

---

## 6. Prompt FRED/Indeed index placeholders

**Problem:** The plan's prompt has `{software_index}` and `{general_index}` placeholders for Pillar 2 labour market normalization. Without these, models can't judge if software job declines are AI-specific or macro.

**Changes to `oq-worker/src/services/prompt.ts`:**
- Add `softwareIndex` and `generalIndex` optional fields to `PromptContext`
- Update Pillar 2 prompt section: *"Software job postings index: {value}. General job postings index: {value}."* — falls back to "Data not currently available" if absent
- No FRED API integration yet — values can be set manually via the scoring input or added later

---

## 7. Seed historical data script

**Problem:** The trend chart requires `history.length > 1` to render. On launch day there's only a single-day seed fallback — the chart is empty.

**Changes:**
- Create `oq-worker/scripts/seed-history.ts`:
  - Insert 7 rows into `oq_scores` backdated from launch date
  - Score path: 28 → 29 → 29 → 30 → 31 → 31 → 32
  - `modelAgreement: "partial"`, `promptHash: "seed"`
  - Analysis: "Seed data — live tracking begins [date]"
- Run via `npx wrangler d1 execute` one time before launch

---

## What I'm NOT including

Explicit skips from the plan or low-priority for v1:

- **FRED API / BLS real integration** — Complex auth, rate limits. Gap 6 just prepares the prompt. Add when live.
- **SWE-bench leaderboard scraping** — Third-party HTML that may change. Add manually or via admin endpoint.
- **Dynamic OG tags** — Requires Worker HTML rewriter for today's score. Revisit if traction.
- **Methodology page** — The plan mentions a dedicated page. The endpoint exists; a rendered page can be added later with minimal effort.

---

## Implementation order

1. OG meta tags (~5 min)
2. What Would Move This Score component + composable update (~30 min)
3. Capability Gap structured component (~30 min)
4. Narrative model disagreement (~20 min)
5. SanityHarness scraper + prompt + admin endpoint (~1 hr)
6. FRED/Indeed prompt placeholders (~10 min)
7. Seed history script (~15 min)

Then: run lint, format, tests, commit, push.
